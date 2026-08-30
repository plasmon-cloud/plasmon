import type { FsNode, FsService } from "../contracts/index.ts";
import { readSystemAppMetadata, resourceCapabilities } from "../fs/index.ts";
import {
  deleteFilesystemNodes,
  type DeleteResult,
  type FileManagerTrashAuthority,
} from "./delete.ts";
import { readSharedShortcut } from "./shortcut.ts";

const RECYCLE_BIN_HANDLER_ID = "native:recycle-bin";

function isRecycleBinSystemApp(node: FsNode): boolean {
  return readSystemAppMetadata(node)?.handlerId === RECYCLE_BIN_HANDLER_ID;
}

/**
 * Recognize the canonical Recycle Bin application or a shortcut to it without
 * relying on display names or filesystem paths.
 */
export async function isRecycleBinDropTarget(fs: FsService, node: FsNode): Promise<boolean> {
  if (isRecycleBinSystemApp(node)) return true;
  const shortcut = readSharedShortcut(node);
  if (!shortcut) return false;
  if (shortcut.target.kind === "native") {
    return shortcut.target.handlerId === RECYCLE_BIN_HANDLER_ID;
  }
  if (shortcut.target.kind !== "node") return false;
  try {
    return isRecycleBinSystemApp(await fs.stat(shortcut.target.nodeId));
  } catch {
    return false;
  }
}

/** Resource policy remains the authority for whether every dragged item may be trashed. */
export function canDropNodesToRecycleBin(nodes: readonly FsNode[]): boolean {
  return nodes.length > 0 && nodes.every((node) => resourceCapabilities(node).delete);
}

/** Delegate the mutation to the same canonical soft-delete path as File Manager Delete. */
export function moveDroppedNodesToRecycleBin(
  trash: FileManagerTrashAuthority,
  nodes: readonly FsNode[],
): Promise<DeleteResult> {
  return deleteFilesystemNodes(trash, nodes);
}
