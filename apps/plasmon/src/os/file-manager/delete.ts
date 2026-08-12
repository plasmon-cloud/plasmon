import type { FsNode, NodeId } from "../contracts/index.ts";

/** Canonical soft-delete authority consumed by FileManager. */
export interface FileManagerTrashAuthority {
  trash(nodeId: NodeId): Promise<unknown>;
}

export interface DeleteFailure {
  nodeId: NodeId;
  name: string;
  message: string;
}

export interface DeleteResult {
  /** Nodes successfully removed from the current folder by moving to Trash. */
  deletedIds: readonly NodeId[];
  /** Ordered failures for nodes that remain in place. */
  failures: readonly DeleteFailure[];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Move every requested node through the canonical Trash authority in stable
 * input order. Failures are collected rather than aborting the batch so a
 * mixed selection has deterministic partial-success semantics.
 */
export async function deleteFilesystemNodes(
  trash: FileManagerTrashAuthority,
  nodes: readonly FsNode[],
): Promise<DeleteResult> {
  const deletedIds: NodeId[] = [];
  const failures: DeleteFailure[] = [];
  for (const node of nodes) {
    try {
      await trash.trash(node.id);
      deletedIds.push(node.id);
    } catch (error: unknown) {
      failures.push({ nodeId: node.id, name: node.name, message: message(error) });
    }
  }
  return { deletedIds, failures };
}

/** Preserve the canonical policy error verbatim for a single failed item. */
export function deleteFailureMessage(failures: readonly DeleteFailure[]): string | null {
  if (failures.length === 0) return null;
  const only = failures[0];
  if (failures.length === 1 && only) return only.message;
  return `${failures.length} items could not be moved to Recycle Bin — ${failures.map((failure) => `${failure.name}: ${failure.message}`).join("; ")}`;
}
