import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticLogger,
} from "../../os/diagnostics/index.ts";
import type { NativeAppComponent, NativeAppComponentProps } from "../../os/process/runtime.ts";
import { logEmulatorJsHandledFailure } from "./diagnostics.ts";
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

/** Build the runtime host with one scoped observer for handled adapter failures. */
export function createEmulatorJsPlayer(
  diagnosticLogger?: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeEmulatorJs>,
): NativeAppComponent {
  return function EmulatorJsPlayer({ target, fs }: NativeAppComponentProps) {
    const runtimeContainerRef = useRef<HTMLDivElement>(null);
    const [rom, setRom] = useState<LoadedRom | null>(null);
    const [state, setState] = useState<PlayerState>("loading");
    const [detail, setDetail] = useState<string | null>(null);

    useEffect(() => {
      let disposed = false;
      const runtimeToken = crypto.randomUUID();

      markPhase(runtimeContainerRef.current, "loading-rom");
      setRom(null);
      setState("loading");
      setDetail(null);

      const load = async () => {
        if (!target.nodeId) throw new Error("EmulatorJS requires a filesystem ROM target");
        const node = await fs.stat(target.nodeId);
        if (node.kind === "directory") throw new Error("EmulatorJS cannot open a directory");
        const bytes = await fs.read(node.id);
        try {
          assertNesRom(bytes);
        } catch (error) {
          logEmulatorJsHandledFailure(diagnosticLogger, { kind: "validation", error });
          throw error;
        }

        if (disposed) return;
        markPhase(runtimeContainerRef.current, "rom-loaded");
        setRom({ name: node.name, bytes: bytes.slice(), runtimeToken });
      };

      void load().catch((error: unknown) => {
        if (disposed) return;
        markPhase(runtimeContainerRef.current, "error", error);
        setState("error");
        setDetail(error instanceof Error ? error.message : String(error));
      });

      return () => {
        disposed = true;
      };
    }, [diagnosticLogger, fs, target.nodeId]);

    useLayoutEffect(() => {
      if (!rom) return;

      const container = runtimeContainerRef.current;
      if (!container) {
        logEmulatorJsHandledFailure(diagnosticLogger, {
          kind: "start",
          stage: DiagnosticStage.RuntimeContainer,
        });
        setState("error");
        setDetail("EmulatorJS runtime container is unavailable");
        return;
      }

      let disposed = false;
      let initialized = false;
      let hostTimeout: ReturnType<typeof setTimeout> | null = null;
      let startTimeout: ReturnType<typeof setTimeout> | null = null;
      const frame = createRuntimeFrame(resolveEmulatorJsHostUrl(document.baseURI, rom.runtimeToken), rom.runtimeToken);

      const clearTimers = () => {
        if (hostTimeout) clearTimeout(hostTimeout);
        if (startTimeout) clearTimeout(startTimeout);
        hostTimeout = null;
        startTimeout = null;
      };

      const fail = (reason: unknown) => {
        if (disposed) return;
        clearTimers();
        delete frame.dataset.emulatorjsReady;
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
          startTimeout = setTimeout(() => {
            startTimeout = null;
            logEmulatorJsHandledFailure(diagnosticLogger, {
              kind: "start",
              stage: DiagnosticStage.RuntimeStart,
              reason: "timeout",
            });
            fail("EmulatorJS did not start within 60 seconds");
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
          logEmulatorJsHandledFailure(diagnosticLogger, {
            kind: "protocol",
            stage: DiagnosticStage.RuntimeMessage,
            error: message.error,
          });
          fail(typeof message.error === "string" ? message.error : "EmulatorJS runtime error");
        }
      };

      window.addEventListener("message", onMessage);
      container.append(frame);
      markPhase(container, "frame-created");
      hostTimeout = setTimeout(() => {
        hostTimeout = null;
        if (!initialized) {
          logEmulatorJsHandledFailure(diagnosticLogger, {
            kind: "start",
            stage: DiagnosticStage.HostReady,
            reason: "timeout",
          });
          fail("EmulatorJS packaged host did not initialize within 10 seconds");
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
          logEmulatorJsHandledFailure(diagnosticLogger, { kind: "stop", error });
          // Closing the process must continue even if the child context already stopped.
        }
        frame.remove();
      };
    }, [diagnosticLogger, rom]);

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
  };
}

export default createEmulatorJsPlayer();
