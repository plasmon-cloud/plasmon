import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { tryParseInternetShortcut } from "../../os/associations/shortcut.ts";
import { createObjectUrlLease, inferVideoMime, safeHttpUrl, youtubeEmbedUrl } from "./media.ts";

export interface VideoPlayerProps { processId: ProcessId; target: OpenTarget; fs: FsService; process: ProcessController; }
type Source = { kind: "video"; url: string; title: string; local: boolean } | { kind: "youtube"; url: string; externalUrl: string; title: string };

async function resolveVideoSource(target: OpenTarget, fs: FsService): Promise<{ source: Source; cleanup: () => void }> {
  let url = target.url; let title = "Video Player";
  if (target.nodeId) {
    const node = await fs.stat(target.nodeId); title = node.name || title;
    if (!url && (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url"))) {
      const shortcut = tryParseInternetShortcut(await fs.read(node.id)); if (!shortcut.ok) throw new Error(shortcut.error.message); url = shortcut.shortcut.url;
    } else if (!url) {
      const bytes = await fs.read(node.id); const blob = new Blob([bytes.slice().buffer], { type: inferVideoMime(node.name, node.mime) }); const lease = createObjectUrlLease(blob, URL); return { source: { kind: "video", url: lease.url, title, local: true }, cleanup: () => lease.release() };
    }
  }
  if (!url) throw new Error("No video target was supplied");
  const safe = safeHttpUrl(url); if (!safe) throw new Error("Video URL must use http:// or https://");
  if (title === "Video Player") title = new URL(safe).hostname || title;
  const embed = youtubeEmbedUrl(safe); if (embed) return { source: { kind: "youtube", url: embed, externalUrl: safe, title }, cleanup: () => {} };
  return { source: { kind: "video", url: safe, title, local: false }, cleanup: () => {} };
}

export default function VideoPlayer({ processId, target, fs, process }: VideoPlayerProps) {
  const [source, setSource] = useState<Source | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { let active = true; let cleanup = () => {}; setLoading(true); setError(null); setSource(null); void resolveVideoSource(target, fs).then((resolved) => { if (!active) { resolved.cleanup(); return; } cleanup = resolved.cleanup; setSource(resolved.source); setLoading(false); process.setTitle(processId, resolved.source.title); }).catch((reason: unknown) => { if (active) { setLoading(false); setError(reason instanceof Error ? reason.message : String(reason)); process.setTitle(processId, "Video Player"); } }); return () => { active = false; cleanup(); }; }, [fs, process, processId, target.nodeId, target.url]);
  const keyDown = (event: KeyboardEvent<HTMLElement>) => { const video = videoRef.current; if (!video) return; if (event.key === " " || event.key.toLowerCase() === "k") { event.preventDefault(); video.paused ? void video.play() : video.pause(); } else if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 5); else if (event.key === "ArrowRight") video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5); else if (event.key === "ArrowUp") video.volume = Math.min(1, video.volume + 0.1); else if (event.key === "ArrowDown") video.volume = Math.max(0, video.volume - 0.1); else if (event.key.toLowerCase() === "f") void video.requestFullscreen?.(); };
  const openExternal = (url: string) => { if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer"); };
  return <section style={styles.root} aria-label="Video player" tabIndex={0} onKeyDown={keyDown}>{loading && <div style={styles.message} role="status">Loading video bytes…</div>}{error && <div style={styles.error} role="alert">{error}</div>}{source?.kind === "video" && <video ref={videoRef} src={source.url} controls preload="metadata" style={styles.video} onError={() => setError("The browser could not play this media source.")}/>} {source?.kind === "youtube" && <><iframe title="YouTube video" src={source.url} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={styles.video}/><button type="button" style={styles.external} onClick={() => openExternal(source.externalUrl)}>Open externally</button></>} {source?.kind === "video" && !source.local && <button type="button" style={styles.external} onClick={() => openExternal(source.url)}>Open externally</button>}<div style={styles.help}>Space/K play-pause · ←/→ seek · ↑/↓ volume · F fullscreen</div></section>;
}
const styles: Record<string, CSSProperties> = { root: { position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center", background: "#111", color: "#eee", outline: "none" }, video: { flex: 1, minHeight: 0, width: "100%", border: 0, background: "#000" }, message: { flex: 1, display: "grid", placeItems: "center", color: "#ccc" }, error: { padding: 12, background: "#3a1717", color: "#ffdada", textAlign: "center" }, external: { position: "absolute", top: 10, right: 10, zIndex: 2 }, help: { padding: "6px 10px", fontSize: 12, color: "#b7bbc2", background: "#191919", textAlign: "center" } };
