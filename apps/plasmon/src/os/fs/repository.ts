import type { FsNode } from "../contracts/fs.ts";

export const STORAGE_CHUNK_BYTES = 512 * 1024;
export const FS_SCHEMA_VERSION = 1;

export interface StoredNode extends FsNode {
  nameKey: string;
}

export interface StoredBlob {
  hash: string;
  size: number;
  chunkCount: number;
  refCount: number;
}

export interface RepositoryState {
  schemaVersion: 1;
  rootId: string;
  revision: string;
  nodes: StoredNode[];
  blobs: StoredBlob[];
}

export interface ChunkWrite {
  hash: string;
  index: number;
  bytes: Uint8Array;
}

export interface ChunkDelete {
  hash: string;
  index: number;
}

export interface RepositoryCommit {
  state: RepositoryState;
  putChunks?: readonly ChunkWrite[];
  deleteChunks?: readonly ChunkDelete[];
}

export interface FsRepository {
  readonly kind: string;
  load(): Promise<RepositoryState | null>;
  readChunk(hash: string, index: number): Promise<Uint8Array | null>;
  commit(change: RepositoryCommit): Promise<void>;
}

export type SqliteRepositoryFactory = () => Promise<FsRepository>;

function chunkKey(hash: string, index: number): string {
  return `${hash}:${index}`;
}

function cloneNode(node: StoredNode): StoredNode {
  return {
    ...node,
    metadata: structuredClone(node.metadata),
  };
}

function cloneState(state: RepositoryState): RepositoryState {
  return {
    ...state,
    nodes: state.nodes.map(cloneNode),
    blobs: state.blobs.map((blob) => ({ ...blob })),
  };
}

/** Deterministic repository used by unit tests and as a last-resort browser fallback. */
export class MemoryFsRepository implements FsRepository {
  readonly kind = "memory";
  private state: RepositoryState | null = null;
  private chunks = new Map<string, Uint8Array>();

  async load(): Promise<RepositoryState | null> {
    return this.state ? cloneState(this.state) : null;
  }

  async readChunk(hash: string, index: number): Promise<Uint8Array | null> {
    return this.chunks.get(chunkKey(hash, index))?.slice() ?? null;
  }

  async commit(change: RepositoryCommit): Promise<void> {
    const nextChunks = new Map(this.chunks);
    for (const chunk of change.putChunks ?? []) {
      nextChunks.set(chunkKey(chunk.hash, chunk.index), chunk.bytes.slice());
    }
    for (const chunk of change.deleteChunks ?? []) {
      nextChunks.delete(chunkKey(chunk.hash, chunk.index));
    }
    this.chunks = nextChunks;
    this.state = cloneState(change.state);
  }
}

const DB_VERSION = 1;
const STATE_STORE = "state";
const CHUNK_STORE = "chunks";
const STATE_KEY = "filesystem";

export interface IndexedDbRepositoryOptions {
  databaseName?: string;
  indexedDB?: IDBFactory;
}

/** Persistent fallback backend. Metadata and content chunks commit atomically. */
export class IndexedDbFsRepository implements FsRepository {
  readonly kind = "indexeddb";
  private readonly databaseName: string;
  private readonly factory: IDBFactory;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDbRepositoryOptions = {}) {
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) throw new Error("IndexedDB is unavailable");
    this.factory = factory;
    this.databaseName = options.databaseName ?? "plasmon-filesystem-v1";
  }

  async load(): Promise<RepositoryState | null> {
    const db = await this.open();
    const tx = db.transaction(STATE_STORE, "readonly");
    const value = await requestValue<RepositoryState | undefined>(tx.objectStore(STATE_STORE).get(STATE_KEY));
    await transactionDone(tx);
    return value ? cloneState(value) : null;
  }

  async readChunk(hash: string, index: number): Promise<Uint8Array | null> {
    const db = await this.open();
    const tx = db.transaction(CHUNK_STORE, "readonly");
    const value = await requestValue<ArrayBuffer | Uint8Array | undefined>(
      tx.objectStore(CHUNK_STORE).get(chunkKey(hash, index)),
    );
    await transactionDone(tx);
    if (!value) return null;
    return value instanceof Uint8Array ? value.slice() : new Uint8Array(value.slice(0));
  }

  async commit(change: RepositoryCommit): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STATE_STORE, CHUNK_STORE], "readwrite");
    const stateStore = tx.objectStore(STATE_STORE);
    const chunkStore = tx.objectStore(CHUNK_STORE);
    stateStore.put(cloneState(change.state), STATE_KEY);
    for (const chunk of change.putChunks ?? []) {
      const copy = chunk.bytes.slice();
      chunkStore.put(copy.buffer, chunkKey(chunk.hash, chunk.index));
    }
    for (const chunk of change.deleteChunks ?? []) {
      chunkStore.delete(chunkKey(chunk.hash, chunk.index));
    }
    await transactionDone(tx);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.factory.open(this.databaseName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
          if (!db.objectStoreNames.contains(CHUNK_STORE)) db.createObjectStore(CHUNK_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB filesystem"));
        request.onblocked = () => reject(new Error("IndexedDB filesystem upgrade is blocked"));
      });
    }
    return this.dbPromise;
  }
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export interface BrowserRepositoryOptions {
  /** Integration-owned SQLite WASM/OPFS adapter. Tried before the built-in fallback. */
  sqliteRepositoryFactory?: SqliteRepositoryFactory;
  indexedDB?: IDBFactory | null;
  databaseName?: string;
  onFallback?: (reason: Error) => void;
}

/**
 * Backend selection is deliberately storage-only. Consumers never learn which
 * repository won. SQLite/OPFS is preferred when the integration layer supplies
 * its factory; IndexedDB is the persistent built-in fallback; memory is last.
 */
export async function createBrowserFsRepository(
  options: BrowserRepositoryOptions = {},
): Promise<FsRepository> {
  if (options.sqliteRepositoryFactory) {
    try {
      const repository = await options.sqliteRepositoryFactory();
      await repository.load();
      return repository;
    } catch (error) {
      options.onFallback?.(asError(error, "SQLite/OPFS filesystem initialization failed"));
    }
  }

  const factory = options.indexedDB === undefined ? globalThis.indexedDB : options.indexedDB;
  if (factory) {
    try {
      const repository = new IndexedDbFsRepository({
        indexedDB: factory,
        databaseName: options.databaseName,
      });
      await repository.load();
      return repository;
    } catch (error) {
      options.onFallback?.(asError(error, "IndexedDB filesystem initialization failed"));
    }
  }

  return new MemoryFsRepository();
}

function asError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback);
}
