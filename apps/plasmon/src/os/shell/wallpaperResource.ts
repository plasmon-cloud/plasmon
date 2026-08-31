import type { FsEvent, FsNode, FsService, NodeId } from "../contracts/index.ts";
import { classifyResource } from "../fs/resourcePolicy.ts";

const BROWSER_WALLPAPER_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
]);

export interface ResolvedFilesystemWallpaper {
  nodeId: NodeId;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface WallpaperDirectoryEntry {
  node: FsNode;
  supportedImage: boolean;
}

export function supportedWallpaperMime(node: FsNode): string | null {
  const classification = classifyResource(node);
  if (classification.kind !== "ordinary-file" || classification.type.contentKind !== "image") return null;
  const mime = classification.type.mime;
  return mime && BROWSER_WALLPAPER_MIMES.has(mime) ? mime : null;
}

export function isSupportedFilesystemWallpaper(node: FsNode): boolean {
  return supportedWallpaperMime(node) !== null;
}

export async function resolveFilesystemWallpaper(
  fs: FsService,
  nodeId: NodeId,
): Promise<ResolvedFilesystemWallpaper | null> {
  try {
    const node = await fs.stat(nodeId);
    const mime = supportedWallpaperMime(node);
    if (!mime) return null;
    const bytes = await fs.read(nodeId);
    return { nodeId, name: node.name, mime, bytes };
  } catch {
    return null;
  }
}

export async function listWallpaperDirectory(
  fs: FsService,
  parentId: NodeId,
): Promise<WallpaperDirectoryEntry[]> {
  const nodes = await fs.list(parentId, { sort: "name" });
  return nodes
    .filter((node) => node.kind === "directory" || classifyResource(node).kind === "ordinary-file")
    .map((node) => ({ node, supportedImage: isSupportedFilesystemWallpaper(node) }));
}

export function wallpaperEventAffectsNode(event: FsEvent, nodeId: NodeId): boolean {
  if (event.type === "reset") return true;
  if (event.type === "removed") return event.id === nodeId;
  return event.node.id === nodeId;
}
