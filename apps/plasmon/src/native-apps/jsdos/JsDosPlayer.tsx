import { useEffect, useRef, useState } from "react";
import type { NativeAppComponentProps } from "../../os/process/runtime.ts";
import { captureJsDosPreview } from "./preview.ts";
import { JsDosProgressStore, createJsDosFsChanges } from "./progress.ts";
import {
  jsDosPackageAssetUrl,
  loadJsDosRuntime,
  startJsDosPlayer,
  type JsDosPlayerHandle,
} from "./runtime.ts";

type PlayerState = "loading" | "starting" | "ready" | "error";

const CLOSE_SAVE_TIMEOUT_MS = 5_000;

function messageFor(state: PlayerState): string {
  if (state === "loading") return "Loading game…";
  if (state === "starting") return "Starting js-dos…";
  if (state === "error") return "Unable to start this DOS bundle.";
  return "";
}

async function saveBeforeClose(saveWork: () => Promise<void>): Promise<"complete" | "timeout"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "complete" | "timeout") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish("timeout"), CLOSE_SAVE_TIMEOUT_MS);
    void saveWork().then(
      () => finish("complete"),
      () => finish("complete"),
    );
  });
}

/**
 * Generic .jsdos execution host. It knows only the selected filesystem node;
 * game names and demo-content policy stay outside runtime dispatch.
 */
export default function JsDosPlayer({ processId, target, fs, process }: NativeAppComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<JsDosPlayerHandle | null>(null);
  const bundleUrlRef = useRef<string | null>(null);
  const allowCloseAfterTimeoutRef = useRef(false);
  const [state, setState] = useState<PlayerState>("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unregisterClose = () => undefined;

    const start = async () => {
      if (!target.nodeId) throw new Error("js-dos requires a filesystem game target");
      const gameNodeId = target.nodeId;
      const root = rootRef.current;
      if (!root) throw new Error("js-dos player container is unavailable");

      const node = await fs.stat(gameNodeId);
      if (node.kind === "directory") throw new Error("js-dos cannot open a directory");
      const bytes = await fs.read(node.id);
      if (bytes.length === 0) throw new Error("DOS bundle is empty");

      const progressStore = new JsDosProgressStore(fs, gameNodeId);
      const bundleUrl = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
      bundleUrlRef.current = bundleUrl;
      setState("starting");

      const Dos = await loadJsDosRuntime();
      if (disposed) return;

      const player = startJsDosPlayer(Dos, root, {
        url: bundleUrl,
        pathPrefix: jsDosPackageAssetUrl(document.baseURI, "emulators/"),
        workerThread: true,
        autoStart: true,
        autoSave: false,
        kiosk: true,
        mouseCapture: false,
        fsChanges: createJsDosFsChanges(fs, gameNodeId, {
          onWarning: (message) => {
            if (!disposed) setProgressWarning(message);
          },
          onRestored: (restored) => {
            if (!disposed) root.dataset.jsdosProgressRestored = restored ? "true" : "false";
          },
          onSaved: () => {
            if (!disposed) root.dataset.jsdosProgressSaved = "true";
          },
        }),
        onEvent: (event) => {
          if (disposed) return;
          if (event === "ci-ready" || event === "bnd-play") {
            root.dataset.jsdosReady = "true";
            setState("ready");
            root.focus({ preventScroll: true });
          }
        },
      });
      playerRef.current = player;
      unregisterClose = process.registerCloseHandler(processId, (request) => {
        if (allowCloseAfterTimeoutRef.current) return "allow";
        const active = playerRef.current;
        if (!active) return "allow";
        void saveBeforeClose(async () => {
          // Capture the representative frame at the same save boundary, but do
          // not attach it until the authoritative #64 save has completed.
          const previewPromise = captureJsDosPreview(root).catch(() => null);
          const saved = await active.save().catch(() => false);
          const preview = await previewPromise;
          if (!saved || !preview) return;
          const savedPreview = await progressStore.savePreview(preview).catch(() => null);
          if (!disposed && savedPreview) root.dataset.jsdosPreviewSaved = "true";
        }).then((result) => {
          if (disposed) return;
          if (result === "timeout") {
            allowCloseAfterTimeoutRef.current = true;
            setProgressWarning("Saving game progress timed out. Close again to exit without saving.");
            request.cancel();
            return;
          }
          request.complete();
        });
        return "defer";
      });
      root.focus({ preventScroll: true });
    };

    void start().catch((error: unknown) => {
      if (disposed) return;
      setState("error");
      setDetail(error instanceof Error ? error.message : String(error));
    });

    return () => {
      disposed = true;
      unregisterClose();
      allowCloseAfterTimeoutRef.current = false;
      if (rootRef.current) {
        delete rootRef.current.dataset.jsdosReady;
        delete rootRef.current.dataset.jsdosProgressRestored;
        delete rootRef.current.dataset.jsdosProgressSaved;
        delete rootRef.current.dataset.jsdosPreviewSaved;
      }
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        void player.stop().catch(() => {
          // Closing the window must continue even if the emulator is already gone.
        });
      }
      const bundleUrl = bundleUrlRef.current;
      bundleUrlRef.current = null;
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
    };
  }, [fs, process, processId, target.nodeId]);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#000" }}
      onPointerDown={() => rootRef.current?.focus({ preventScroll: true })}
    >
      <div
        ref={rootRef}
        tabIndex={0}
        aria-label="DOS game"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", outline: "none" }}
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
      {state === "ready" && progressWarning ? (
        <div
          role="status"
          style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: "8px 10px", color: "#fff", background: "rgba(0, 0, 0, 0.8)" }}
        >
          {progressWarning}
        </div>
      ) : null}
    </div>
  );
}
