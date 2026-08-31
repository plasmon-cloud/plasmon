import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { tryParseInternetShortcut } from "../../os/associations/shortcut.ts";
import {
  NativeAppButton,
  NativeAppContentSurface,
  NativeAppStateSurface,
  NativeAppStatusStrip,
} from "../../os/visual/index.ts";
import {
  reportVideoPlaybackError,
  reportVideoPlaybackStartFailure,
  reportVideoSourceResolveFailure,
} from "../semanticDiagnostics.ts";
import {
  createObjectUrlLease,
  inferVideoMime,
  nativeVideoSupportForMime,
  safeHttpUrl,
  videoPlaybackErrorMessage,
  youtubeEmbedUrl,
} from "./media.ts";

export interface VideoPlayerProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
}

type Source =
  | { kind: "video"; url: string; title: string; local: boolean; mime: string }
  | { kind: "youtube"; url: string; externalUrl: string; title: string };

export function isExpectedVideoPlayRejection(reason: unknown): boolean {
  if (!reason || typeof reason !== "object" || !("name" in reason)) return false;
  return reason.name === "NotAllowedError" || reason.name === "AbortError";
}

async function resolveVideoSource(
  target: OpenTarget,
  fs: FsService,
): Promise<{ source: Source; cleanup: () => void }> {
  let url = target.url;
  let title = "Video Player";

  if (target.nodeId) {
    const node = await fs.stat(target.nodeId);
    title = node.name || title;
    if (!url && (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url"))) {
      const shortcut = tryParseInternetShortcut(await fs.read(node.id));
      if (!shortcut.ok) {
        reportVideoSourceResolveFailure();
        throw new Error(shortcut.error.message);
      }
      url = shortcut.shortcut.url;
    } else if (!url) {
      const bytes = await fs.read(node.id);
      const mime = inferVideoMime(node.name, node.mime);
      const blob = new Blob([bytes.slice().buffer], { type: mime });
      const lease = createObjectUrlLease(blob, URL);
      return {
        source: { kind: "video", url: lease.url, title, local: true, mime },
        cleanup: () => lease.release(),
      };
    }
  }

  if (!url) throw new Error("No video target was supplied");
  const safe = safeHttpUrl(url);
  if (!safe) {
    reportVideoSourceResolveFailure();
    throw new Error("Video URL must use http:// or https://");
  }
  if (title === "Video Player") title = new URL(safe).hostname || title;
  const embed = youtubeEmbedUrl(safe);
  if (embed) {
    return {
      source: { kind: "youtube", url: embed, externalUrl: safe, title },
      cleanup: () => {},
    };
  }
  return {
    source: {
      kind: "video",
      url: safe,
      title,
      local: false,
      mime: inferVideoMime(new URL(safe).pathname),
    },
    cleanup: () => {},
  };
}

export default function VideoPlayer({ processId, target, fs, process }: VideoPlayerProps) {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    setLoading(true);
    setError(null);
    setUnsupported(null);
    setSource(null);

    if (!target.nodeId && !target.url) {
      setLoading(false);
      process.setTitle(processId, "Video Player");
      return () => { active = false; };
    }

    void resolveVideoSource(target, fs)
      .then((resolved) => {
        if (!active) {
          resolved.cleanup();
          return;
        }

        cleanup = resolved.cleanup;
        let unsupportedMessage: string | null = null;
        if (
          resolved.source.kind === "video"
          && resolved.source.mime !== "application/octet-stream"
          && typeof document !== "undefined"
        ) {
          const probe = document.createElement("video");
          if (nativeVideoSupportForMime(resolved.source.mime, probe) === "unsupported") {
            unsupportedMessage = videoPlaybackErrorMessage(
              resolved.source.title,
              resolved.source.mime,
              4,
            );
          }
        }

        setSource(resolved.source);
        setUnsupported(unsupportedMessage);
        setLoading(false);
        process.setTitle(processId, resolved.source.title);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setLoading(false);
        setError(reason instanceof Error ? reason.message : String(reason));
        process.setTitle(processId, "Video Player");
      });

    return () => {
      active = false;
      cleanup();
    };
  }, [fs, process, processId, target.nodeId, target.url]);

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    const video = videoRef.current;
    if (!video) return;

    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (video.paused) {
        void video.play().catch((reason: unknown) => {
          if (!isExpectedVideoPlayRejection(reason)) reportVideoPlaybackStartFailure();
        });
      } else {
        video.pause();
      }
    } else if (event.key === "ArrowLeft") {
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (event.key === "ArrowRight") {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
    } else if (event.key === "ArrowUp") {
      video.volume = Math.min(1, video.volume + 0.1);
    } else if (event.key === "ArrowDown") {
      video.volume = Math.max(0, video.volume - 0.1);
    } else if (event.key.toLowerCase() === "f") {
      const fullscreen = video.requestFullscreen?.();
      if (fullscreen) {
        void fullscreen.catch(() => {
          setError("Browser fullscreen is unavailable in this hosted view.");
        });
      }
    }
  };

  const openExternal = (url: string) => {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <NativeAppContentSurface style={styles.root} aria-label="Video player" tabIndex={0} onKeyDown={keyDown}>
      {loading && <NativeAppStateSurface role="status">Loading video bytes…</NativeAppStateSurface>}
      {error && <NativeAppStateSurface tone="error" role="alert">{error}</NativeAppStateSurface>}
      {unsupported && (
        <NativeAppStateSurface style={styles.unsupported} role="alert">
          {unsupported}
        </NativeAppStateSurface>
      )}
      {!loading && !error && !unsupported && !source && (
        <NativeAppStateSurface role="status">Open a video file or supported URL to start playback.</NativeAppStateSurface>
      )}

      {source?.kind === "video" && !unsupported && (
        <video
          ref={videoRef}
          src={source.url}
          controls
          preload="metadata"
          style={styles.video}
          onCanPlay={() => setUnsupported(null)}
          onError={() => {
            reportVideoPlaybackError();
            setUnsupported(videoPlaybackErrorMessage(
              source.title,
              source.mime,
              videoRef.current?.error?.code,
            ));
          }}
        />
      )}

      {source?.kind === "youtube" && (
        <>
          <iframe
            title="YouTube video"
            src={source.url}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={styles.video}
          />
          <NativeAppButton type="button" style={styles.external} onClick={() => openExternal(source.externalUrl)}>
            Open externally
          </NativeAppButton>
        </>
      )}

      {source?.kind === "video" && !source.local && (
        <NativeAppButton type="button" style={styles.external} onClick={() => openExternal(source.url)}>
          Open externally
        </NativeAppButton>
      )}

      <NativeAppStatusStrip style={styles.help}>
        Space/K play-pause · ←/→ seek · ↑/↓ volume · F fullscreen
      </NativeAppStatusStrip>
    </NativeAppContentSurface>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    outline: "none",
  },
  video: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    border: 0,
    background: "#000",
  },
  unsupported: {
    lineHeight: 1.5,
  },
  external: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  help: {
    justifyContent: "center",
    textAlign: "center",
  },
};