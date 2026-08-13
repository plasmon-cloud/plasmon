export type FileOperationKind = "import" | "paste";
export type FileOperationStatus = "idle" | "running" | "completed" | "failed";

export interface FileOperationFailure {
  item: string;
  message: string;
}

export interface FileOperationSnapshot {
  kind: FileOperationKind | null;
  status: FileOperationStatus;
  totalItems: number;
  processedItems: number;
  succeededItems: number;
  failedItems: number;
  currentIndex: number | null;
  currentItem: string | null;
  failures: readonly FileOperationFailure[];
}

function idleOperation(): FileOperationSnapshot {
  return {
    kind: null,
    status: "idle",
    totalItems: 0,
    processedItems: 0,
    succeededItems: 0,
    failedItems: 0,
    currentIndex: null,
    currentItem: null,
    failures: [],
  };
}

export class FileOperationState {
  private value: FileOperationSnapshot = idleOperation();
  private readonly listeners = new Set<(snapshot: FileOperationSnapshot) => void>();

  snapshot(): FileOperationSnapshot {
    return { ...this.value, failures: this.value.failures.map((failure) => ({ ...failure })) };
  }

  subscribe(listener: (snapshot: FileOperationSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return this.value.status === "running";
  }

  begin(kind: FileOperationKind, totalItems: number): boolean {
    if (this.isRunning()) return false;
    if (!Number.isSafeInteger(totalItems) || totalItems <= 0) {
      throw new Error("File operations require a positive item total");
    }
    this.value = {
      kind,
      status: "running",
      totalItems,
      processedItems: 0,
      succeededItems: 0,
      failedItems: 0,
      currentIndex: null,
      currentItem: null,
      failures: [],
    };
    this.emit();
    return true;
  }

  startItem(index: number, item: string): void {
    this.requireRunning();
    if (!Number.isSafeInteger(index) || index < 1 || index > this.value.totalItems) {
      throw new Error("File operation item index is out of range");
    }
    this.value = { ...this.value, currentIndex: index, currentItem: item };
    this.emit();
  }

  succeedItem(): void {
    this.requireRunning();
    this.value = {
      ...this.value,
      processedItems: this.value.processedItems + 1,
      succeededItems: this.value.succeededItems + 1,
      currentIndex: null,
      currentItem: null,
    };
    this.emit();
  }

  failItem(item: string, message: string): void {
    this.requireRunning();
    this.value = {
      ...this.value,
      processedItems: this.value.processedItems + 1,
      failedItems: this.value.failedItems + 1,
      currentIndex: null,
      currentItem: null,
      failures: [...this.value.failures, { item, message }],
    };
    this.emit();
  }

  completeKnownItems(count: number): void {
    this.requireRunning();
    if (!Number.isSafeInteger(count) || count < 0 || count > this.value.totalItems) {
      throw new Error("File operation completion count is out of range");
    }
    this.value = {
      ...this.value,
      processedItems: count,
      succeededItems: count,
      failedItems: 0,
      currentIndex: null,
      currentItem: null,
    };
    this.emit();
  }

  complete(): void {
    this.requireRunning();
    this.value = {
      ...this.value,
      status: this.value.failedItems > 0 ? "failed" : "completed",
      currentIndex: null,
      currentItem: null,
    };
    this.emit();
  }

  fail(message: string): void {
    this.requireRunning();
    this.value = {
      ...this.value,
      status: "failed",
      currentIndex: null,
      currentItem: null,
      failures: [...this.value.failures, { item: "Operation", message }],
    };
    this.emit();
  }

  private requireRunning(): void {
    if (!this.isRunning()) throw new Error("No file operation is running");
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
