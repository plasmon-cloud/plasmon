import type { FsNode, FsService } from "./contracts/index.ts";
import { classifyResource } from "./fs/resourcePolicy.ts";
import { readResourcePreviewMetadata } from "./fs/resourcePreview.ts";

export const MAX_IMAGE_THUMBNAIL_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_THUMBNAIL_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_THUMBNAIL_DIMENSION = 320;
export const VIDEO_THUMBNAIL_TIMEOUT_MS = 5_000;

const VIDEO_THUMBNAIL_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
]);

/**
 * Return the canonical effective image MIME when this resource is image content.
 * Classification remains owned by the filesystem resource-policy seam.
 */
export function imageThumbnailMime(node: FsNode): string | null {
  const classification = classifyResource(node);
  return classification.type.contentKind === "image" ? classification.type.mime : null;
}

/**
 * Return a conservative browser-thumbnail candidate MIME for video content.
 * Runtime codec support remains a browser media decision during extraction.
 */
export function videoThumbnailMime(node: FsNode): string | null {
  const classification = classifyResource(node);
  const mime = classification.type.contentKind === "video"
    ? classification.type.mime?.toLowerCase() ?? null
    : null;
  return mime && VIDEO_THUMBNAIL_MIMES.has(mime) ? mime : null;
}

export function canLoadImageThumbnail(node: FsNode, maxBytes = MAX_IMAGE_THUMBNAIL_BYTES): boolean {
  return node.kind === "file" && node.size > 0 && node.size <= maxBytes && imageThumbnailMime(node) !== null;
}

export function canLoadVideoThumbnail(node: FsNode, maxBytes = MAX_VIDEO_THUMBNAIL_BYTES): boolean {
  return node.kind === "file" && node.size > 0 && node.size <= maxBytes && videoThumbnailMime(node) !== null;
}

export interface ThumbnailObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface LoadedImageThumbnail {
  url: string;
  revoke(): void;
}

export interface VideoThumbnailDimensions {
  width: number;
  height: number;
}

export function videoThumbnailDimensions(
  width: number,
  height: number,
  maxDimension = MAX_VIDEO_THUMBNAIL_DIMENSION,
): VideoThumbnailDimensions | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) return null;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function representativeVideoFrameTime(durationSeconds: number): number | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const upper = Math.max(0, durationSeconds - 0.001);
  return Math.min(upper, Math.min(1, durationSeconds * 0.1));
}

export interface VideoThumbnailCleanup {
  add(cleanup: () => void): void;
  run(): void;
}

/** Idempotent cleanup ledger used by the browser extraction lifecycle. */
export function createVideoThumbnailCleanup(): VideoThumbnailCleanup {
  const cleanups: Array<() => void> = [];
  let cleaned = false;
  return {
    add(cleanup) {
      if (cleaned) {
        try { cleanup(); } catch { /* cleanup is best-effort */ }
        return;
      }
      cleanups.push(cleanup);
    },
    run() {
      if (cleaned) return;
      cleaned = true;
      for (let index = cleanups.length - 1; index >= 0; index -= 1) {
        try { cleanups[index]?.(); } catch { /* cleanup is best-effort */ }
      }
      cleanups.length = 0;
    },
  };
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesAsDataUrl(bytes: Uint8Array, mime: string): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1]! : 0;
    const third = hasThird ? bytes[index + 2]! : 0;
    const bits = (first << 16) | (second << 8) | third;

    encoded += BASE64_ALPHABET[(bits >>> 18) & 0x3f];
    encoded += BASE64_ALPHABET[(bits >>> 12) & 0x3f];
    encoded += hasSecond ? BASE64_ALPHABET[(bits >>> 6) & 0x3f] : "=";
    encoded += hasThird ? BASE64_ALPHABET[bits & 0x3f] : "=";
  }
  return `data:${mime};base64,${encoded}`;
}

async function loadedThumbnail(
  bytes: Uint8Array,
  mime: string,
  urlApi: ThumbnailObjectUrlApi,
): Promise<LoadedImageThumbnail> {
  const blob = new Blob([bytes], { type: mime });
  const url = urlApi.createObjectURL(blob);
  if (url.startsWith("blob:null/")) {
    urlApi.revokeObjectURL(url);
    return {
      // Opaque-origin installed frames cannot load blob:null URLs. Encode from
      // the already-read bounded bytes without depending on DOM-only FileReader,
      // so the shared loader remains testable in Bun and usable in the browser.
      url: bytesAsDataUrl(bytes, mime),
      revoke() {},
    };
  }

  let revoked = false;
  return {
    url,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      urlApi.revokeObjectURL(url);
    },
  };
}

export async function loadResourcePreviewThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
): Promise<LoadedImageThumbnail | null> {
  const preview = readResourcePreviewMetadata(node);
  if (!preview) return null;

  try {
    const image = await fs.stat(preview.nodeId);
    if (image.kind !== "file"
      || image.mime !== preview.mime
      || image.size !== preview.byteSize
      || image.size <= 0) return null;
    const bytes = await fs.read(image.id, { offset: 0, length: image.size });
    if (bytes.byteLength !== preview.byteSize) return null;
    return loadedThumbnail(bytes, preview.mime, urlApi);
  } catch {
    return null;
  }
}

export async function loadImageThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
): Promise<LoadedImageThumbnail | null> {
  const mime = imageThumbnailMime(node);
  if (!mime || !canLoadImageThumbnail(node)) return null;
  const bytes = await fs.read(node.id, { offset: 0, length: node.size });
  if (bytes.byteLength === 0) return null;
  return loadedThumbnail(bytes, mime, urlApi);
}

export interface VideoThumbnailLoadOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  document?: Document | undefined;
}

function mediaSourceForBytes(
  bytes: Uint8Array,
  mime: string,
  urlApi: ThumbnailObjectUrlApi,
  cleanup: VideoThumbnailCleanup,
): string {
  const url = urlApi.createObjectURL(new Blob([bytes], { type: mime }));
  if (url.startsWith("blob:null/")) {
    urlApi.revokeObjectURL(url);
    return bytesAsDataUrl(bytes, mime);
  }
  cleanup.add(() => urlApi.revokeObjectURL(url));
  return url;
}

export async function loadVideoThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
  options: VideoThumbnailLoadOptions = {},
): Promise<LoadedImageThumbnail | null> {
  const mime = videoThumbnailMime(node);
  if (!mime || !canLoadVideoThumbnail(node) || options.signal?.aborted) return null;

  const browserDocument = options.document ?? (typeof document === "undefined" ? undefined : document);
  if (!browserDocument) return null;

  let bytes: Uint8Array;
  try {
    bytes = await fs.read(node.id, { offset: 0, length: node.size });
  } catch {
    return null;
  }
  if (bytes.byteLength !== node.size || bytes.byteLength === 0 || options.signal?.aborted) return null;

  const video = browserDocument.createElement("video");
  if (!video.canPlayType(mime)) return null;
  const canvas = browserDocument.createElement("canvas");
  const cleanup = createVideoThumbnailCleanup();
  const source = mediaSourceForBytes(bytes, mime, urlApi, cleanup);
  const timeoutMs = options.timeoutMs ?? VIDEO_THUMBNAIL_TIMEOUT_MS;

  video.muted = true;
  video.volume = 0;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = "auto";

  return new Promise<LoadedImageThumbnail | null>((resolve) => {
    let settled = false;
    let targetTime: number | null = null;

    const finish = (result: LoadedImageThumbnail | null) => {
      if (settled) return;
      settled = true;
      cleanup.run();
      resolve(result);
    };

    const capture = () => {
      if (options.signal?.aborted) {
        finish(null);
        return;
      }
      const dimensions = videoThumbnailDimensions(video.videoWidth, video.videoHeight);
      if (!dimensions) {
        finish(null);
        return;
      }
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) {
        finish(null);
        return;
      }
      try {
        context.drawImage(video, 0, 0, dimensions.width, dimensions.height);
        const url = canvas.toDataURL("image/jpeg", 0.82);
        finish(url && url !== "data:," ? { url, revoke() {} } : null);
      } catch {
        finish(null);
      }
    };

    const onLoadedMetadata = () => {
      targetTime = representativeVideoFrameTime(video.duration);
      if (targetTime === null) {
        finish(null);
        return;
      }
      if (targetTime <= 0.001 && video.readyState >= 2) {
        capture();
        return;
      }
      try {
        video.currentTime = targetTime;
      } catch {
        finish(null);
      }
    };
    const onLoadedData = () => {
      if (targetTime !== null && targetTime <= 0.001) capture();
    };
    const onSeeked = () => capture();
    const onError = () => finish(null);
    const onAbort = () => finish(null);

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    cleanup.add(() => video.removeEventListener("loadedmetadata", onLoadedMetadata));
    cleanup.add(() => video.removeEventListener("loadeddata", onLoadedData));
    cleanup.add(() => video.removeEventListener("seeked", onSeeked));
    cleanup.add(() => video.removeEventListener("error", onError));

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
      cleanup.add(() => options.signal?.removeEventListener("abort", onAbort));
    }

    const timer = setTimeout(() => finish(null), Math.max(1, timeoutMs));
    cleanup.add(() => clearTimeout(timer));
    cleanup.add(() => {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch { /* detached media cleanup is best-effort */ }
      canvas.width = 0;
      canvas.height = 0;
    });

    try {
      video.src = source;
      video.load();
    } catch {
      finish(null);
    }
  });
}

/**
 * Load the canonical referenced preview first, then a bounded direct image, then
 * a bounded browser-decoded representative video frame. Callers own the returned
 * image lease and must revoke it where one exists.
 */
export async function loadResourceThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
  options: VideoThumbnailLoadOptions = {},
): Promise<LoadedImageThumbnail | null> {
  if (options.signal?.aborted) return null;
  const preview = await loadResourcePreviewThumbnail(fs, node, urlApi);
  if (preview || options.signal?.aborted) return preview;
  if (canLoadImageThumbnail(node)) return loadImageThumbnail(fs, node, urlApi);
  if (canLoadVideoThumbnail(node)) return loadVideoThumbnail(fs, node, urlApi, options);
  return null;
}
