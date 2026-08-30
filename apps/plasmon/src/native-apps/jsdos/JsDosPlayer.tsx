import { useEffect, useRef, useState } from "react";
import {
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticLogger,
} from "../../os/diagnostics/index.ts";
import type { NativeAppComponent, NativeAppComponentProps } from "../../os/process/runtime.ts";
import { logJsDosHandledFailure } from "./diagnostics.ts";
import { captureJsDosPreview } from "./preview.ts";
import { JsDosProgressStore, createJsDosFsChanges } from "./progress.ts";
import {
  jsDosPackageAssetUrl,
  loadJsDosRuntime,
  startJsDosPlayer,
  type JsDosPlayerHandle,
} from "./runtime.ts";
import { waitForJsDosSave } from "./save-lifecycle.ts";

type PlayerState = "loading" | "starting" | "ready" | "error";

const CLOSE_SAVE_TIMEOUT_MS = 5_000;

function messageFor(state: PlayerState): string {
  if (state === "loading") return "Loading game…";
  if (state === "starting") return "Starting js-dos…";
  if (state === "error") return "Unable to start this DOS bundle.";
  return "";
}

/**
 * Build the runtime host with the one scoped observer used only at handled
 * js-dos adapter boundaries. NativeAppComponentProps stays diagnostic-free.
 */
export function createJsDosPlayer(
  diagnosticLogger?: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeJsDos>,
): NativeAppComponent {
  return function JsDosPlayer({ processId, target, fs, process }: NativeAppComponentProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<JsDosPlayerHandle | null>(null);
    const bundleUrlRef = useRef<string | null>(null);
    const allowCloseWithoutSaveRef = useRef(false);
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

        let Dos;
        try {
          Dos = await loadJsDosRuntime();
        } catch (error) {
          logJsDosHandledFailure(diagnosticLogger, { kind: "start", stage: DiagnosticStage.RuntimeLoad, error });
          throw error;
        }
        if (disposed) return;

        let player: JsDosPlayerHandle;
        try {
          player = startJsDosPlayer(Dos, root, {
            url: bundleUrl,
            pathPrefix: jsDosPackageAssetUrl(document.baseURI, "emulators/"),
            workerThread: true,
            autoStart: true,
            autoSave: false,
            kiosk: true,
            mouseCapture: false,
            fsChanges: createJsDosFsChanges(fs, gameNodeId, {
              onWarning: (message) => {
                logJsDosHandledFailure(diagnosticLogger, { kind: "restore" });
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
        } catch (error) {
          logJsDosHandledFailure(diagnosticLogger, { kind: "start", stage: DiagnosticStage.RuntimeStart, error });
          throw error;
        }

        playerRef.current = player;
        unregisterClose = process.registerCloseHandler(processId, (request) => {
          if (allowCloseWithoutSaveRef.current) return "allow";
          const active = playerRef.current;
          if (!active) return "allow";
          void waitForJsDosSave(async () => {
            const previewPromise = captureJsDosPreview(root).catch(() => null);
            const saved = await active.save();
            const preview = await previewPromise;
            if (saved && preview) {
              const savedPreview = await progressStore.savePreview(preview).catch(() => null);
              if (!disposed && savedPreview) root.dataset.jsdosPreviewSaved = "true";
            }
            return saved;
          }, CLOSE_SAVE_TIMEOUT_MS).then((result) => {
            if (disposed) return;
            if (result === "timeout" || result === "failed") {
              logJsDosHandledFailure(diagnosticLogger, { kind: "save", reason: result });
              allowCloseWithoutSaveRef.current = true;
              setProgressWarning(
                result === "timeout"
                  ? "Saving game progress timed out. Close again to exit without saving."
                  : "Game progress could not be saved. Close again to exit without saving.",
              );
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
        allowCloseWithoutSaveRef.current = false;
        if (rootRef.current) {
          delete rootRef.current.dataset.jsdosReady;
          delete rootRef.current.dataset.jsdosProgressRestored;
          delete rootRef.current.dataset.jsdosProgressSaved;
          delete rootRef.current.dataset.jsdosPreviewSaved;
        }
        const player = playerRef.current;
        playerRef.current = null;
        if (player) {
          void player.stop().catch((error: unknown) => {
            logJsDosHandledFailure(diagnosticLogger, { kind: "stop", error });
            // Closing the window must continue even if the emulator is already gone.
          });
        }
        const bundleUrl = bundleUrlRef.current;
        bundleUrlRef.current = null;
        if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      };
    }, [diagnosticLogger, fs, process, processId, target.nodeId]);

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
  };
}

export default createJsDosPlayer();
