import type { NodeId } from "../../os/contracts/index.ts";

export interface ExplorerLocation {
  nodeId: NodeId;
  path: string;
}

export interface ExplorerHistorySnapshot {
  entries: readonly ExplorerLocation[];
  index: number;
}

export class ExplorerHistory {
  private entries: ExplorerLocation[] = [];
  private index = -1;

  constructor(initial?: ExplorerLocation) {
    if (initial) this.push(initial);
  }

  push(location: ExplorerLocation): void {
    const current = this.current();
    if (current?.nodeId === location.nodeId) {
      this.entries[this.index] = { ...location };
      return;
    }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ ...location });
    this.index = this.entries.length - 1;
  }

  replaceCurrent(location: ExplorerLocation): void {
    if (this.index < 0) this.push(location);
    else this.entries[this.index] = { ...location };
  }

  current(): ExplorerLocation | null {
    const value = this.entries[this.index];
    return value ? { ...value } : null;
  }

  at(index: number): ExplorerLocation | null {
    const value = this.entries[index];
    return value ? { ...value } : null;
  }

  canBack(): boolean {
    return this.index > 0;
  }

  canForward(): boolean {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  moveTo(index: number): ExplorerLocation | null {
    if (index < 0 || index >= this.entries.length) return null;
    this.index = index;
    return this.current();
  }

  removeAt(index: number): void {
    if (index < 0 || index >= this.entries.length) return;
    this.entries.splice(index, 1);
    if (this.entries.length === 0) {
      this.index = -1;
      return;
    }
    if (index < this.index) this.index -= 1;
    else if (index === this.index && this.index >= this.entries.length) this.index = this.entries.length - 1;
  }

  back(): ExplorerLocation | null {
    if (!this.canBack()) return this.current();
    return this.moveTo(this.index - 1);
  }

  forward(): ExplorerLocation | null {
    if (!this.canForward()) return this.current();
    return this.moveTo(this.index + 1);
  }

  snapshot(): ExplorerHistorySnapshot {
    return { entries: this.entries.map((entry) => ({ ...entry })), index: this.index };
  }
}
