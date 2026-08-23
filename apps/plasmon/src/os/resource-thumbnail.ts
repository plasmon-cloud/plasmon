import type { FsNode, FsService } from "./contracts/index.ts";
import { classifyResource } from "./fs/resourcePolicy.ts";
import { readResourcePreviewMetadata } from "./fs/resourcePreview.ts";

export const MAX_IMAGE_THUMBNAIL_BYTES = 8 * 1024 * 1024;

/**
 * Return the canonical effective image MIME when this resource is image content.
 * Classification remains owned by the filesystem resource-policy seam.
 */
export function imageThumbnailMime(node: FsNode): string | null {
  const classification = classifyResource(node);
  return classification.type.contentKind === "image" ? classification.type.mime : null;
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

/**
 * Load the canonical referenced preview first, then the resource itself when it
 * is a bounded image. Callers own the returned lease and must revoke it.
 */
export async function loadResourceThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
): Promise<LoadedImageThumbnail | null> {
  const preview = await loadResourcePreviewThumbnail(fs, node, urlApi);
  return preview ?? (canLoadImageThumbnail(node) ? loadImageThumbnail(fs, node, urlApi) : null);
}
