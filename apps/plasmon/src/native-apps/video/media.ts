const VIDEO_MIME: Readonly<Record<string, string>> = Object.freeze({ ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".ogv": "video/ogg", ".ogg": "video/ogg" });

export function safeHttpUrl(value: string): string | null { try { const url = new URL(value.trim()); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
export function inferVideoMime(name: string, declaredMime?: string): string { if (declaredMime?.toLowerCase().startsWith("video/")) return declaredMime.toLowerCase(); const lower = name.toLowerCase(); for (const [extension, mime] of Object.entries(VIDEO_MIME)) if (lower.endsWith(extension)) return mime; return "application/octet-stream"; }
export function youtubeVideoId(value: string): string | null {
  const normalized = safeHttpUrl(value); if (!normalized) return null; const url = new URL(normalized); const host = url.hostname.toLowerCase().replace(/^www\./, ""); let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (host === "youtube.com" || host === "m.youtube.com") { if (url.pathname === "/watch") id = url.searchParams.get("v"); else { const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/); id = match?.[1] ?? null; } }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}
export function youtubeEmbedUrl(value: string): string | null { const id = youtubeVideoId(value); return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null; }
export interface ObjectUrlApi { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void; }
export interface ObjectUrlLease { url: string; release(): void; }
export function createObjectUrlLease(blob: Blob, api: ObjectUrlApi): ObjectUrlLease { const url = api.createObjectURL(blob); let released = false; return { url, release() { if (!released) { released = true; api.revokeObjectURL(url); } } }; }
