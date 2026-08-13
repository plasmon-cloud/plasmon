import { useEffect, useRef, useState } from "react";
import type { NativeAppComponentProps } from "../../os/process/runtime.ts";
import {
  jsDosPackageAssetUrl,
  loadJsDosRuntime,
  startJsDosPlayer,
  type JsDosPlayerHandle,
} from "./runtime.ts";

type PlayerState = "loading" | "starting" | "ready" | "error";

function messageFor(state: PlayerState): string {
  if (state === "loading") return "Loading game…";
  if (state === "starting") return "Starting js-dos…";
  if (state === "error") return "Unable to start this DOS bundle.";
  return "";
}

/**
 * Generic .jsdos execution host. It knows only the selected filesystem node;
 * game names and demo-content policy stay outside runtime dispatch.
 */
export default function JsDosPlayer({ target, fs }: NativeAppComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<JsDosPlayerHandle | null>(null);
  const bundleUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const start = async () => {
      if (!target.nodeId) throw new Error("js-dos requires a filesystem game target");
      const root = rootRef.current;
      if (!root) throw new Error("js-dos player container is unavailable");

      const node = await fs.stat(target.nodeId);
      if (node.kind === "directory") throw new Error("js-dos cannot open a directory");
      const bytes = await fs.read(node.id);
      if (bytes.length === 0) throw new Error("DOS bundle is empty");

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
      root.focus({ preventScroll: true });
    };

    void start().catch((error: unknown) => {
      if (disposed) return;
      setState("error");
      setDetail(error instanceof Error ? error.message : String(error));
    });

    return () => {
      disposed = true;
      if (rootRef.current) delete rootRef.current.dataset.jsdosReady;
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
  }, [fs, target.nodeId]);

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
    </div>
  );
}
