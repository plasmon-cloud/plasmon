import { classifyResource } from "../../os/fs/index.ts";

export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function inferVideoMime(name: string, declaredMime?: string): string {
  const path = name.split(/[?#]/u, 1)[0]!;
  const classification = classifyResource({
    name: path,
    kind: "file",
    metadata: {},
    ...(declaredMime ? { mime: declaredMime } : {}),
  });
  return classification.type.mime ?? "application/octet-stream";
}

export type NativeVideoSupport = "supported" | "unsupported" | "unknown";
export interface VideoCapabilityProbe {
  canPlayType(type: string): string;
}

export function nativeVideoSupportForMime(
  mime: string,
  probe: VideoCapabilityProbe,
): NativeVideoSupport {
  const normalized = mime.trim().toLowerCase();
  if (!normalized.startsWith("video/")) return "unknown";
  try {
    return probe.canPlayType(normalized) === "" ? "unsupported" : "supported";
  } catch {
    return "unknown";
  }
}

export function videoPlaybackErrorMessage(
  title: string,
  mime: string,
  mediaErrorCode?: number,
): string {
  const format = mime && mime !== "application/octet-stream" ? ` (${mime})` : "";
  if (mediaErrorCode === 2) {
    return `The browser could not load ${title}${format}. Check the media URL or network connection.`;
  }
  if (mediaErrorCode === 3) {
    return `The browser received ${title}${format} but could not decode it with its native media codecs.`;
  }
  return `The browser cannot play ${title}${format} with its native media codecs. Plasmon does not bundle a transcoder or codec pack. Try a browser-supported MP4, WebM, or Ogg video.`;
}

export function youtubeVideoId(value: string): string | null {
  const normalized = safeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export function youtubeEmbedUrl(value: string): string | null {
  const id = youtubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
}

export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}
export interface ObjectUrlLease {
  url: string;
  release(): void;
}
export function createObjectUrlLease(blob: Blob, api: ObjectUrlApi): ObjectUrlLease {
  const url = api.createObjectURL(blob);
  let released = false;
  return {
    url,
    release() {
      if (!released) {
        released = true;
        api.revokeObjectURL(url);
      }
    },
  };
}
