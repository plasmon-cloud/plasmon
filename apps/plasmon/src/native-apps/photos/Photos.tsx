import Panzoom from "@panzoom/panzoom";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { exitFullscreenSafely, requestFullscreenSafely } from "./fullscreen.ts";
import { adjacentImageNode, createImageObjectUrlLease, inferImageMime } from "./media.ts";
import {
  enterWorkspaceExpand,
  exitWorkspaceExpand,
  type WorkspaceExpandSession,
  type WorkspaceWindowControl,
} from "./workspaceExpand.ts";

export interface PhotosProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
  nativeWindow?: WorkspaceWindowControl;
}

type PhotoSource = { url: string; title: string; mime: string };
type PanzoomInstance = ReturnType<typeof Panzoom>;
type PanzoomChangeEvent = Event & { detail?: { scale?: number } };

export default function Photos({ processId, target, fs, process, nativeWindow }: PhotosProps) {
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [loading, setLoading] = useState(Boolean(target.nodeId));
  const [error, setError] = useState<string | null>(null);
  const [displayNotice, setDisplayNotice] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const panzoomRef = useRef<PanzoomInstance | null>(null);
  const workspaceExpandRef = useRef<WorkspaceExpandSession | null>(null);

  useEffect(() => {
    let active = true;
    let release = () => {};
    setSource(null);
    setImageReady(false);
    setScale(1);
    setError(null);
    setDisplayNotice(null);

    if (!target.nodeId) {
      setLoading(false);
      process.setTitle(processId, "Photos");
      return () => { active = false; };
    }

    setLoading(true);
    void (async () => {
      const node = await fs.stat(target.nodeId!);
      const mime = inferImageMime(node.name, node.mime);
      if (!mime) throw new Error(`Photos does not support ${node.name || "this resource"}.`);
      const bytes = await fs.read(node.id);
      const lease = createImageObjectUrlLease(bytes, node.name, node.mime, URL);
      if (!active) {
        lease.release();
        return;
      }
      release = lease.release;
      setSource({ url: lease.url, title: node.name || "Photos", mime: lease.mime });
      setLoading(false);
      process.setTitle(processId, node.name || "Photos");
    })().catch((reason: unknown) => {
      if (!active) return;
      setLoading(false);
      setError(reason instanceof Error ? reason.message : String(reason));
      process.setTitle(processId, "Photos");
    });

    return () => {
      active = false;
      release();
    };
  }, [fs, process, processId, target.nodeId]);

  useEffect(() => {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!imageReady || !image || !viewport) return;

    const panzoom = Panzoom(image, {
      cursor: "grab",
      maxScale: 8,
      minScale: 1,
      panOnlyWhenZoomed: true,
      step: 0.2,
    });
    panzoomRef.current = panzoom;
    setScale(panzoom.getScale());

    const onChange = (event: Event) =>
      setScale((event as PanzoomChangeEvent).detail?.scale ?? panzoom.getScale());
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      panzoom.zoomWithWheel(event, { step: 0.25 });
    };

    image.addEventListener("panzoomchange", onChange);
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      image.removeEventListener("panzoomchange", onChange);
      viewport.removeEventListener("wheel", onWheel);
      panzoom.destroy();
      if (panzoomRef.current === panzoom) panzoomRef.current = null;
      setScale(1);
    };
  }, [imageReady, source?.url]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFullscreen = () => {
      const isFullscreen = document.fullscreenElement === rootRef.current;
      setFullscreen(isFullscreen);
      if (isFullscreen) {
        workspaceExpandRef.current = null;
        setExpanded(false);
        setDisplayNotice(null);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const fit = () => panzoomRef.current?.reset({ animate: true });
  const zoomIn = () => panzoomRef.current?.zoomIn({ animate: true });
  const zoomOut = () => panzoomRef.current?.zoomOut({ animate: true });

  const actualSize = () => {
    const image = imageRef.current;
    const panzoom = panzoomRef.current;
    if (!image || !panzoom || !image.clientWidth || !image.clientHeight) return;
    const naturalScale = Math.max(
      image.naturalWidth / image.clientWidth,
      image.naturalHeight / image.clientHeight,
      1,
    );
    panzoom.zoom(Math.min(8, naturalScale), { animate: true });
  };

  const toggleDisplayMode = async () => {
    const root = rootRef.current;
    if (!root || typeof document === "undefined") return;

    if (document.fullscreenElement === root) {
      const exitError = await exitFullscreenSafely(document);
      if (exitError) setDisplayNotice(exitError);
      return;
    }

    if (expanded) {
      exitWorkspaceExpand(nativeWindow, workspaceExpandRef.current);
      workspaceExpandRef.current = null;
      setExpanded(false);
      setDisplayNotice(null);
      return;
    }

    const result = await requestFullscreenSafely(root, document);
    if (result.mode === "expanded") {
      workspaceExpandRef.current = enterWorkspaceExpand(nativeWindow);
      setExpanded(true);
      setDisplayNotice(result.message);
    }
  };

  const navigate = async (direction: -1 | 1) => {
    const nodeId = target.nodeId;
    if (!nodeId) return;
    try {
      const current = await fs.stat(nodeId);
      if (current.parentId === null) return;
      const siblings = await fs.list(current.parentId, { sort: "name" });
      const next = adjacentImageNode(siblings, current.id, direction);
      if (!next) return;
      const { url: _url, ...rest } = target;
      process.setTarget(processId, { ...rest, nodeId: next.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      void navigate(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomIn();
    } else if (event.key === "-") {
      event.preventDefault();
      zoomOut();
    } else if (event.key === "0") {
      event.preventDefault();
      fit();
    } else if (event.key === "1") {
      event.preventDefault();
      actualSize();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      void toggleDisplayMode();
    }
  };

  const controlsDisabled = !imageReady;
  const policyBlocksFullscreen =
    typeof document !== "undefined" && document.fullscreenEnabled === false;
  const displayModeLabel = fullscreen
    ? "Exit fullscreen"
    : expanded
      ? "Exit expanded"
      : policyBlocksFullscreen
        ? "Expand"
        : "Fullscreen";

  return (
    <section
      ref={rootRef}
      style={styles.root}
      aria-label="Photos"
      data-photos-display-mode={fullscreen ? "fullscreen" : expanded ? "expanded" : "normal"}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {!expanded ? (
        <nav style={styles.toolbar} aria-label="Photo controls">
          <button type="button" style={buttonStyle(controlsDisabled)} disabled={controlsDisabled} onClick={zoomOut}>Zoom out</button>
          <span style={styles.scale}>{Math.round(scale * 100)}%</span>
          <button type="button" style={buttonStyle(controlsDisabled || scale >= 8)} disabled={controlsDisabled || scale >= 8} onClick={zoomIn}>Zoom in</button>
          <button type="button" style={buttonStyle(controlsDisabled)} disabled={controlsDisabled} onClick={fit}>Fit</button>
          <button type="button" style={buttonStyle(controlsDisabled)} disabled={controlsDisabled} onClick={actualSize}>Actual size</button>
          <span style={styles.spacer} />
          <button
            type="button"
            style={buttonStyle(controlsDisabled)}
            disabled={controlsDisabled}
            onClick={() => { void toggleDisplayMode(); }}
          >
            {displayModeLabel}
          </button>
        </nav>
      ) : (
        <button
          type="button"
          style={styles.expandedExit}
          onClick={() => { void toggleDisplayMode(); }}
        >
          Exit expanded
        </button>
      )}

      {displayNotice && <div style={styles.notice} role="status">{displayNotice}</div>}

      <div ref={viewportRef} style={styles.viewport}>
        {loading && <div style={styles.message} role="status">Loading image bytes…</div>}
        {!loading && !target.nodeId && <div style={styles.message} role="status">Choose an image to open.</div>}
        {source && (
          <img
            key={source.url}
            ref={imageRef}
            src={source.url}
            alt={source.title}
            draggable={false}
            decoding="async"
            style={{ ...styles.image, display: error ? "none" : "block" }}
            onLoad={() => {
              setImageReady(true);
              setError(null);
            }}
            onError={() => {
              setImageReady(false);
              setError(`Photos could not display ${source.title}. The file may be corrupt or unsupported by this browser.`);
            }}
          />
        )}
        {error && <div style={styles.error} role="alert">{error}</div>}
      </div>

      {!expanded && (
        <footer style={styles.status}>
          <span>{source?.mime ?? "Image"}</span>
          <span>←/→ next image · +/- zoom · 0 fit · 1 actual · F fullscreen/expand</span>
        </footer>
      )}
    </section>
  );
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 30,
    padding: "5px 10px",
    border: "1px solid #4a515d",
    borderRadius: 4,
    background: disabled ? "#24282e" : "#343a43",
    color: disabled ? "#7f8791" : "#f1f3f6",
    font: "600 12px/1.2 system-ui, sans-serif",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: 1,
  };
}

const styles: Record<string, CSSProperties> = {
  root: { position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "#141619", color: "#eef1f5", outline: "none" },
  expandedExit: { position: "absolute", top: 10, right: 10, zIndex: 4, minHeight: 30, padding: "5px 10px", border: "1px solid #4a515d", borderRadius: 4, background: "#343a43", color: "#f1f3f6", font: "600 12px/1.2 system-ui, sans-serif", cursor: "pointer" },
  toolbar: { display: "flex", alignItems: "center", gap: 8, padding: 8, background: "#202329", borderBottom: "1px solid #373c45" },
  scale: { minWidth: 48, color: "#bbc2cc", textAlign: "center", font: "12px/1 system-ui, sans-serif" },
  spacer: { flex: 1 },
  notice: { padding: "6px 10px", background: "#272d35", color: "#d4d9e0", borderBottom: "1px solid #3b434e", font: "12px/1.35 system-ui, sans-serif" },
  viewport: { position: "relative", flex: 1, minWidth: 0, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none", background: "#111315" },
  image: { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", userSelect: "none", transformOrigin: "50% 50%" },
  message: { display: "grid", placeItems: "center", width: "100%", height: "100%", padding: 24, boxSizing: "border-box", color: "#aab1bb" },
  error: { display: "grid", placeItems: "center", width: "100%", height: "100%", padding: 28, boxSizing: "border-box", color: "#ffd4d8", textAlign: "center" },
  status: { display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 10px", borderTop: "1px solid #373c45", background: "#1b1e23", color: "#aab1bb", font: "12px/1.3 system-ui, sans-serif" },
};
