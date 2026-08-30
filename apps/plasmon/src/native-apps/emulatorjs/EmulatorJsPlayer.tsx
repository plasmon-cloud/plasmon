import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NativeAppComponentProps } from "../../os/process/runtime.ts";
import { assertNesRom, resolveEmulatorJsHostUrl } from "./runtime.ts";

type PlayerState = "loading" | "starting" | "ready" | "error";

interface LoadedRom {
  name: string;
  bytes: Uint8Array;
  runtimeToken: string;
}

interface RuntimeMessage {
  channel?: unknown;
  token?: unknown;
  phase?: unknown;
  error?: unknown;
}

const RUNTIME_CHANNEL = "plasmon-emulatorjs";

function errorKind(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

function messageFor(state: PlayerState): string {
  if (state === "loading") return "Loading ROM…";
  if (state === "starting") return "Starting EmulatorJS…";
  if (state === "error") return "Unable to start this NES ROM.";
  return "";
}

function createRuntimeFrame(hostUrl: string, runtimeToken: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.title = "NES game";
  frame.setAttribute("aria-label", "NES game");
  frame.dataset.emulatorjsInit = runtimeToken;
  frame.src = hostUrl;
  frame.style.position = "absolute";
  frame.style.inset = "0";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.border = "0";
  frame.style.background = "#000";
  return frame;
}

function markPhase(container: HTMLDivElement | null, phase: string, error?: unknown): void {
  if (!container) return;
  container.dataset.emulatorjsPhase = phase;
  if (error === undefined) {
    delete container.dataset.emulatorjsError;
  } else {
    container.dataset.emulatorjsError = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Association-backed NES host. The selected filesystem node is the only game
 * input; title-specific dispatch stays outside the runtime path.
 *
 * EmulatorJS exposes browser-global EJS_* configuration, so every Plasmon
 * process receives its own child browsing context. Neutron intentionally
 * isolates application frames, which means Plasmon must not depend on direct
 * access to a nested iframe's contentDocument. The packaged child host owns its
 * EJS globals and loader, receives validated ROM bytes via postMessage, and
 * reports only real EmulatorJS lifecycle progress back to this process host.
 */
export default function EmulatorJsPlayer({
  target,
  fs,
  diagnostics,
  operation,
}: NativeAppComponentProps) {
  const runtimeContainerRef = useRef<HTMLDivElement>(null);
  const [rom, setRom] = useState<LoadedRom | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const log = useMemo(() => {
    if (!diagnostics) return null;
    return operation
      ? diagnostics.continueOperation(operation).for("runtime.emulatorjs")
      : diagnostics.for("runtime.emulatorjs");
  }, [diagnostics, operation]);

  useEffect(() => {
    let disposed = false;
    const runtimeToken = crypto.randomUUID();
    let loadStage = "target-validation";

    markPhase(runtimeContainerRef.current, "loading-rom");
    setRom(null);
    setState("loading");
    setDetail(null);

    const load = async () => {
      if (!target.nodeId) throw new Error("EmulatorJS requires a filesystem ROM target");
      loadStage = "filesystem-stat";
      const node = await fs.stat(target.nodeId);
      loadStage = "target-validation";
      if (node.kind === "directory") throw new Error("EmulatorJS cannot open a directory");
      loadStage = "filesystem-read";
      const bytes = await fs.read(node.id);
      loadStage = "rom-validation";
      assertNesRom(bytes);

      if (disposed) return;
      markPhase(runtimeContainerRef.current, "rom-loaded");
      setRom({ name: node.name, bytes: bytes.slice(), runtimeToken });
    };

    void load().catch((error: unknown) => {
      if (disposed) return;
      if (loadStage !== "filesystem-stat" && loadStage !== "filesystem-read") {
        log?.error("runtime.emulatorjs.start.failed", {
          message: "EmulatorJS runtime input could not be prepared",
          runtime: "EmulatorJS",
          core: "nes",
          stage: loadStage,
          errorKind: errorKind(error),
        });
      }
      markPhase(runtimeContainerRef.current, "error", error);
      setState("error");
      setDetail(error instanceof Error ? error.message : String(error));
    });

    return () => {
      disposed = true;
    };
  }, [fs, log, target.nodeId]);

  useLayoutEffect(() => {
    if (!rom) return;

    const container = runtimeContainerRef.current;
    if (!container) {
      log?.error("runtime.emulatorjs.start.failed", {
        message: "EmulatorJS runtime container is unavailable",
        runtime: "EmulatorJS",
        core: "nes",
        stage: "runtime-container",
      });
      setState("error");
      setDetail("EmulatorJS runtime container is unavailable");
      return;
    }

    let disposed = false;
    let initialized = false;
    let hostTimeout: ReturnType<typeof setTimeout> | null = null;
    let startTimeout: ReturnType<typeof setTimeout> | null = null;
    let frame: HTMLIFrameElement;
    try {
      frame = createRuntimeFrame(
        resolveEmulatorJsHostUrl(document.baseURI, rom.runtimeToken),
        rom.runtimeToken,
      );
    } catch (error) {
      log?.error("runtime.emulatorjs.start.failed", {
        message: "EmulatorJS runtime frame could not be created",
        runtime: "EmulatorJS",
        core: "nes",
        stage: "frame-create",
        errorKind: errorKind(error),
      });
      setState("error");
      setDetail(error instanceof Error ? error.message : String(error));
      return;
    }

    const clearTimers = () => {
      if (hostTimeout) clearTimeout(hostTimeout);
      if (startTimeout) clearTimeout(startTimeout);
      hostTimeout = null;
      startTimeout = null;
    };

    const fail = (reason: unknown, stage: string) => {
      if (disposed) return;
      clearTimers();
      delete frame.dataset.emulatorjsReady;
      log?.error("runtime.emulatorjs.start.failed", {
        message: "EmulatorJS runtime failed during startup",
        runtime: "EmulatorJS",
        core: "nes",
        stage,
        errorKind: errorKind(reason),
      });
      markPhase(container, "error", reason);
      setState("error");
      setDetail(reason instanceof Error ? reason.message : String(reason || "EmulatorJS runtime error"));
    };

    const onMessage = (event: MessageEvent<RuntimeMessage>) => {
      if (disposed || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== RUNTIME_CHANNEL || message.token !== rom.runtimeToken) return;
      if (typeof message.phase !== "string") return;

      if (message.phase === "host-ready") {
        if (initialized) return;
        initialized = true;
        if (hostTimeout) clearTimeout(hostTimeout);
        hostTimeout = null;
        setState("starting");
        setDetail(null);
        markPhase(container, "host-ready");

        const bytes = rom.bytes.slice().buffer as ArrayBuffer;
        try {
          frame.contentWindow?.postMessage(
            {
              channel: RUNTIME_CHANNEL,
              token: rom.runtimeToken,
              command: "init",
              gameName: rom.name,
              bytes,
            },
            "*",
            [bytes],
          );
        } catch (error) {
          log?.error("runtime.emulatorjs.start.failed", {
            message: "EmulatorJS runtime initialization message failed",
            runtime: "EmulatorJS",
            core: "nes",
            stage: "init-transfer",
            errorKind: errorKind(error),
          });
          throw error;
        }
        startTimeout = setTimeout(() => {
          startTimeout = null;
          fail("EmulatorJS did not start within 60 seconds", "runtime-start-timeout");
        }, 60_000);
        return;
      }

      if (message.phase === "configured") {
        markPhase(container, "configured");
        return;
      }
      if (message.phase === "loader-injected") {
        frame.dataset.emulatorjsBootstrap = "true";
        markPhase(container, "loader-injected");
        return;
      }
      if (message.phase === "loaded") {
        frame.dataset.emulatorjsLoaded = "true";
        markPhase(container, "loader-ready");
        return;
      }
      if (message.phase === "ready") {
        if (startTimeout) clearTimeout(startTimeout);
        startTimeout = null;
        frame.dataset.emulatorjsReady = "true";
        markPhase(container, "game-started");
        setState("ready");
        frame.focus();
        return;
      }
      if (message.phase === "error") {
        fail(
          typeof message.error === "string" ? message.error : "EmulatorJS runtime error",
          "runtime-message",
        );
      }
    };

    window.addEventListener("message", onMessage);
    container.append(frame);
    markPhase(container, "frame-created");
    hostTimeout = setTimeout(() => {
      hostTimeout = null;
      if (!initialized) {
        fail("EmulatorJS packaged host did not initialize within 10 seconds", "host-ready-timeout");
      }
    }, 10_000);

    return () => {
      disposed = true;
      clearTimers();
      window.removeEventListener("message", onMessage);
      try {
        frame.contentWindow?.postMessage({
          channel: RUNTIME_CHANNEL,
          token: rom.runtimeToken,
          command: "terminate",
        }, "*");
      } catch (error) {
        log?.debug("runtime.emulatorjs.stop.failed", {
          message: "EmulatorJS terminate message failed during cleanup",
          runtime: "EmulatorJS",
          core: "nes",
          stage: "cleanup-terminate",
          errorKind: errorKind(error),
        });
      }
      frame.remove();
    };
  }, [log, rom]);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#000" }}
    >
      <div
        ref={runtimeContainerRef}
        data-emulatorjs-runtime-host="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {state !== "ready" ? (
        <div
          role={state === "error" ? "alert" : "status"}
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, color: "#fff", background: "#000", textAlign: "center" }}
        >
          <div>
            <div>{messageFor(state)}</div>
            {detail ? <div style={{ marginTop: 8, opacity: 0.75 }}>{detail}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
