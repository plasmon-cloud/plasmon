import Panzoom from "@panzoom/panzoom";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import {
  NativeAppButton,
  NativeAppContentSurface,
  NativeAppStateSurface,
  NativeAppStatusStrip,
  NativeAppToolbar,
} from "../../os/visual/index.ts";
import { reportPhotosDecodeFailure } from "../semanticDiagnostics.ts";
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
    <NativeAppContentSurface
      ref={rootRef}
      style={styles.root}
      aria-label="Photos"
      data-photos-display-mode={fullscreen ? "fullscreen" : expanded ? "expanded" : "normal"}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {!expanded ? (
        <NativeAppToolbar as="nav" aria-label="Photo controls">
          <NativeAppButton type="button" disabled={controlsDisabled} onClick={zoomOut}>Zoom out</NativeAppButton>
          <span style={styles.scale}>{Math.round(scale * 100)}%</span>
          <NativeAppButton type="button" disabled={controlsDisabled || scale >= 8} onClick={zoomIn}>Zoom in</NativeAppButton>
          <NativeAppButton type="button" disabled={controlsDisabled} onClick={fit}>Fit</NativeAppButton>
          <NativeAppButton type="button" disabled={controlsDisabled} onClick={actualSize}>Actual size</NativeAppButton>
          <span style={styles.spacer} />
          <NativeAppButton
            type="button"
            disabled={controlsDisabled}
            onClick={() => { void toggleDisplayMode(); }}
          >
            {displayModeLabel}
          </NativeAppButton>
        </NativeAppToolbar>
      ) : (
        <NativeAppButton
          type="button"
          style={styles.expandedExit}
          onClick={() => { void toggleDisplayMode(); }}
        >
          Exit expanded
        </NativeAppButton>
      )}

      {displayNotice && <div style={styles.notice} role="status">{displayNotice}</div>}

      <div ref={viewportRef} style={styles.viewport}>
        {loading && <NativeAppStateSurface role="status">Loading image bytes…</NativeAppStateSurface>}
        {!loading && !target.nodeId && <NativeAppStateSurface role="status">Choose an image to open.</NativeAppStateSurface>}
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
              reportPhotosDecodeFailure();
              setImageReady(false);
              setError(`Photos could not display ${source.title}. The file may be corrupt or unsupported by this browser.`);
            }}
          />
        )}
        {error && <NativeAppStateSurface tone="error" role="alert">{error}</NativeAppStateSurface>}
      </div>

      {!expanded && (
        <NativeAppStatusStrip style={styles.status}>
          <span>{source?.mime ?? "Image"}</span>
          <span>←/→ next image · +/- zoom · 0 fit · 1 actual · F fullscreen/expand</span>
        </NativeAppStatusStrip>
      )}
    </NativeAppContentSurface>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    outline: "none",
  },
  expandedExit: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 4,
  },
  scale: {
    minWidth: 48,
    color: "var(--plasmon-text-secondary)",
    textAlign: "center",
    fontSize: "var(--plasmon-font-size-small)",
    lineHeight: 1,
  },
  spacer: { flex: 1 },
  notice: {
    padding: "6px 10px",
    background: "var(--plasmon-panel-elevated)",
    color: "var(--plasmon-text-secondary)",
    borderBottom: "1px solid var(--plasmon-border-subtle)",
    fontSize: "var(--plasmon-font-size-small)",
    lineHeight: 1.35,
  },
  viewport: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    touchAction: "none",
    background: "#111315",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    userSelect: "none",
    transformOrigin: "50% 50%",
  },
  status: {
    justifyContent: "space-between",
  },
};
