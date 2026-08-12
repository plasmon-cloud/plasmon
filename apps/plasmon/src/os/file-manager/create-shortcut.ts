import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { canResourceOperation, createShortcut } from "../fs/index.ts";
import { emptySelection, selectNode, type SelectionState } from "./model.ts";

export interface FileManagerCreateShortcutResult {
  shortcut: FsNode;
  selection: SelectionState;
}

/**
 * Resolve the one selected resource eligible for FileManager Create Shortcut.
 * Eligibility remains filesystem policy; FileManager only adds the single-
 * selection command requirement.
 */
export function fileManagerShortcutTarget(
  nodes: readonly FsNode[],
  selectedIds: ReadonlySet<NodeId>,
): FsNode | null {
  if (selectedIds.size !== 1) return null;
  const [selectedId] = selectedIds;
  if (!selectedId) return null;
  const target = nodes.find((node) => node.id === selectedId) ?? null;
  return target && canResourceOperation(target, "create-shortcut") ? target : null;
}

export function canCreateFileManagerShortcut(
  nodes: readonly FsNode[],
  selectedIds: ReadonlySet<NodeId>,
): boolean {
  return fileManagerShortcutTarget(nodes, selectedIds) !== null;
}

/**
 * Create a same-directory shortcut through the canonical filesystem primitive.
 * The target is stored by stable NodeId and the returned selection is the normal
 * FileManager single-selection state used before inline rename begins.
 */
export async function createFileManagerShortcut(
  fs: FsService,
  parentId: NodeId,
  target: FsNode,
): Promise<FileManagerCreateShortcutResult> {
  if (!canResourceOperation(target, "create-shortcut")) {
    throw new Error(`Shortcut creation is not available for ${target.name}`);
  }

  const shortcut = await createShortcut(fs, parentId, {
    kind: "node",
    nodeId: target.id,
  });

  return {
    shortcut,
    selection: selectNode(emptySelection(), [shortcut.id], shortcut.id),
  };
}
