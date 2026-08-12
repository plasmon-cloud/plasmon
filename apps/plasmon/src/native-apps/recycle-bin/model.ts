import type { FsEventSource, FsNodeKind, NodeId } from "../../os/contracts/index.ts";
import type { FilesystemTrashService, TrashEntry } from "../../os/fs/index.ts";

export interface RecycleBinItem {
  id: NodeId;
  name: string;
  originalPath: string;
  deletedAt: number;
  kind: FsNodeKind;
  size: number;
}

export interface RecycleBinRestoreResult {
  itemId: NodeId;
  nodeId: NodeId;
  name: string;
  usedFallback: boolean;
  renamed: boolean;
}

export function recycleBinItem(entry: TrashEntry): RecycleBinItem {
  return {
    id: entry.node.id,
    name: entry.originalName,
    originalPath: entry.originalPath,
    deletedAt: entry.deletedAt,
    kind: entry.node.kind,
    size: entry.node.size,
  };
}

function uniqueIds(ids: readonly NodeId[]): NodeId[] {
  return [...new Set(ids)];
}

/**
 * Production action model for Recycle Bin UI. It intentionally depends only on
 * the canonical filesystem Trash facade and never reads Trash wrapper nodes.
 */
export class RecycleBinModel {
  constructor(private readonly trash: FilesystemTrashService) {}

  async list(): Promise<RecycleBinItem[]> {
    return (await this.trash.list()).map(recycleBinItem);
  }

  async restore(ids: readonly NodeId[]): Promise<RecycleBinRestoreResult[]> {
    const restored: RecycleBinRestoreResult[] = [];
    for (const itemId of uniqueIds(ids)) {
      const result = await this.trash.restore(itemId);
      restored.push({
        itemId,
        nodeId: result.node.id,
        name: result.node.name,
        usedFallback: result.usedFallback,
        renamed: result.renamed,
      });
    }
    return restored;
  }

  async permanentlyDelete(ids: readonly NodeId[]): Promise<number> {
    let removed = 0;
    for (const itemId of uniqueIds(ids)) {
      await this.trash.permanentlyDelete(itemId);
      removed += 1;
    }
    return removed;
  }

  async empty(): Promise<number> {
    return this.trash.empty();
  }
}

/** FsEventSource events are invalidations; callers re-read TrashService state. */
export function subscribeRecycleBinInvalidation(
  events: FsEventSource | undefined,
  invalidate: () => void,
): () => void {
  return events?.subscribe(() => invalidate()) ?? (() => undefined);
}
