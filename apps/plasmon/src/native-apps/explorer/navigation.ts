import type { FsService, NodeId } from "../../os/contracts/index.ts";
import {
  ExplorerHistory,
  type ExplorerHistorySnapshot,
  type ExplorerLocation,
} from "./history.ts";

export async function resolveExplorerNode(
  fs: FsService,
  nodeId: NodeId,
): Promise<ExplorerLocation> {
  const node = await fs.stat(nodeId);
  if (node.kind !== "directory") throw new Error(`${node.name} is not a folder`);
  return { nodeId: node.id, path: await fs.pathOf(node.id) };
}

export async function resolveExplorerAddress(
  fs: FsService,
  value: string,
): Promise<ExplorerLocation> {
  const requested = value.trim() || "/";
  const node = await fs.resolvePath(requested);
  if (!node) throw new Error(`Folder not found: ${requested}`);
  if (node.kind !== "directory") throw new Error(`Not a folder: ${requested}`);
  return { nodeId: node.id, path: await fs.pathOf(node.id) };
}

/**
 * Per-Explorer deterministic navigation authority. Filesystem owns identity and
 * path resolution; this model owns only the transient Back/Forward/Up history.
 */
export class ExplorerNavigationModel {
  private readonly history: ExplorerHistory;

  constructor(
    private readonly fs: FsService,
    initial: ExplorerLocation,
  ) {
    this.history = new ExplorerHistory(initial);
  }

  current(): ExplorerLocation | null {
    return this.history.current();
  }

  snapshot(): ExplorerHistorySnapshot {
    return this.history.snapshot();
  }

  canBack(): boolean {
    return this.history.canBack();
  }

  canForward(): boolean {
    return this.history.canForward();
  }

  async navigateNode(nodeId: NodeId): Promise<ExplorerLocation> {
    const next = await resolveExplorerNode(this.fs, nodeId);
    this.history.push(next);
    return next;
  }

  async navigatePath(path: string): Promise<ExplorerLocation> {
    const next = await resolveExplorerAddress(this.fs, path);
    this.history.push(next);
    return next;
  }

  async refreshCurrent(): Promise<ExplorerLocation | null> {
    const current = this.history.current();
    if (!current) return null;
    const next = await resolveExplorerNode(this.fs, current.nodeId);
    this.history.replaceCurrent(next);
    return next;
  }

  async up(): Promise<ExplorerLocation | null> {
    const current = this.history.current();
    if (!current) return null;
    const node = await this.fs.stat(current.nodeId);
    if (node.kind !== "directory") throw new Error(`${node.name} is not a folder`);
    if (!node.parentId) return current;
    return this.navigateNode(node.parentId);
  }

  back(): Promise<ExplorerLocation | null> {
    return this.moveHistory(-1);
  }

  forward(): Promise<ExplorerLocation | null> {
    return this.moveHistory(1);
  }

  private async moveHistory(step: -1 | 1): Promise<ExplorerLocation | null> {
    while (step < 0 ? this.history.canBack() : this.history.canForward()) {
      const snapshot = this.history.snapshot();
      const candidateIndex = snapshot.index + step;
      const candidate = this.history.at(candidateIndex);
      if (!candidate) break;

      try {
        const next = await resolveExplorerNode(this.fs, candidate.nodeId);
        this.history.moveTo(candidateIndex);
        this.history.replaceCurrent(next);
        return next;
      } catch {
        // A deleted/unreachable historical target is not allowed to corrupt the
        // cursor. Remove it and continue toward the next valid location.
        this.history.removeAt(candidateIndex);
      }
    }

    return this.history.current();
  }
}
