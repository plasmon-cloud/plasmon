import type { FsNode, FsService } from "../contracts/index.ts";
import { readResourcePreviewMetadata } from "../fs/resourcePreview.ts";

export const MAX_IMAGE_THUMBNAIL_BYTES = 8 * 1024 * 1024;

const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

export function imageThumbnailMime(node: FsNode): string | null {
  if (node.mime?.startsWith("image/")) return node.mime;
  return IMAGE_MIME_BY_EXTENSION[extension(node.name)] ?? null;
}

export function canLoadImageThumbnail(node: FsNode, maxBytes = MAX_IMAGE_THUMBNAIL_BYTES): boolean {
  return node.kind === "file" && node.size > 0 && node.size <= maxBytes && imageThumbnailMime(node) !== null;
}

export interface ThumbnailObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface LoadedImageThumbnail {
  url: string;
  revoke(): void;
}

function loadedThumbnail(bytes: Uint8Array, mime: string, urlApi: ThumbnailObjectUrlApi): LoadedImageThumbnail {
  const blob = new Blob([bytes], { type: mime });
  const url = urlApi.createObjectURL(blob);
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
