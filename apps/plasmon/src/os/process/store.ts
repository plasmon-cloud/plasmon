import type {
  JsonValue,
  OpenTarget,
  ProcessId,
  ProcessRecord,
} from "../contracts/index.ts";

function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneJsonValue(nested)]),
    );
  }
  return value;
}

function cloneJsonRecord(values: Record<string, JsonValue>): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, cloneJsonValue(value)]),
  );
}

function cloneTarget(target: OpenTarget): OpenTarget {
  return {
    ...target,
    ...(target.atom
      ? {
          atom: {
            ...target.atom,
            ...(target.atom.metadata
              ? { metadata: cloneJsonRecord(target.atom.metadata) }
              : {}),
          },
        }
      : {}),
  };
}

function cloneRecord(record: ProcessRecord): ProcessRecord {
  return { ...record, target: cloneTarget(record.target) };
}

/** Internal mutable state. No consumer outside the subsystem needs this store. */
export class ProcessStore {
  private readonly records = new Map<ProcessId, ProcessRecord>();
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(id: ProcessId): ProcessRecord | null {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : null;
  }

  find(predicate: (record: ProcessRecord) => boolean): ProcessRecord | null {
    for (const record of this.records.values()) {
      const snapshot = cloneRecord(record);
      if (predicate(snapshot)) return snapshot;
    }
    return null;
  }

  list(): readonly ProcessRecord[] {
    return [...this.records.values()].map(cloneRecord);
  }

  add(record: ProcessRecord): void {
    if (this.records.has(record.id)) {
      throw new Error(`Process already exists: ${record.id}`);
    }
    this.records.set(record.id, cloneRecord(record));
    this.emit();
  }

  patch(id: ProcessId, patch: Partial<ProcessRecord>): boolean {
    const current = this.records.get(id);
    if (!current) return false;
    this.records.set(id, cloneRecord({ ...current, ...patch }));
    this.emit();
    return true;
  }

  remove(id: ProcessId): boolean {
    const removed = this.records.delete(id);
    if (removed) this.emit();
    return removed;
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
