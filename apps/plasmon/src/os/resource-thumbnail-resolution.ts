import type { FsNode, FsService } from "./contracts/index.ts";
import { readResourcePreviewMetadata } from "./fs/resourcePreview.ts";
import { readSharedShortcut } from "./fs/shortcut.ts";
import {
  canLoadImageThumbnail,
  canLoadVideoThumbnail,
  loadResourceThumbnail,
  type LoadedImageThumbnail,
  type ThumbnailObjectUrlApi,
  type VideoThumbnailLoadOptions,
} from "./resource-thumbnail.ts";

/**
 * Resolve the resource whose bounded thumbnail a presentation may borrow.
 * Node-target shortcuts are followed through FsService only; this seam never
 * opens or executes the shortcut target. Cycles, missing targets, unsupported
 * resources, and aborted work fail closed to null.
 */
export async function resolveResourceThumbnailNode(
  fs: FsService,
  node: FsNode,
  signal?: AbortSignal,
): Promise<FsNode | null> {
  let current = node;
  const visited = new Set<string>();

  while (!signal?.aborted) {
    if (visited.has(current.id)) return null;
    visited.add(current.id);

    if (readResourcePreviewMetadata(current)
      || canLoadImageThumbnail(current)
      || canLoadVideoThumbnail(current)) {
      return current;
    }

    const shortcut = readSharedShortcut(current);
    if (!shortcut || shortcut.target.kind !== "node") return null;
    try {
      current = await fs.stat(shortcut.target.nodeId);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolve shortcut presentation indirection and load through the canonical
 * bounded thumbnail loader. Read/decode failures remain presentation fallback,
 * not errors that escape the thumbnail adapter.
 */
export async function loadResolvedResourceThumbnail(
  fs: FsService,
  node: FsNode,
  urlApi: ThumbnailObjectUrlApi = URL,
  options: VideoThumbnailLoadOptions = {},
): Promise<LoadedImageThumbnail | null> {
  if (options.signal?.aborted) return null;
  const resolved = await resolveResourceThumbnailNode(fs, node, options.signal);
  if (!resolved || options.signal?.aborted) return null;
  try {
    return await loadResourceThumbnail(fs, resolved, urlApi, options);
  } catch {
    return null;
  }
}
