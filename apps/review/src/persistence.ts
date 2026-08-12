import type {
  AtomId,
  CommandReceipt,
  ReviewAtomMeta,
  ReviewAtomState,
  ReviewCheckpoint,
  ReviewComment,
  ReviewItem,
  ReviewRevision,
  RevisionId,
} from "./model.ts";
import { cloneState } from "./model.ts";

export interface ReviewPersistenceCommit {
  meta: ReviewAtomMeta;
  revision: ReviewRevision;
  receipt: CommandReceipt;
  putItems?: ReviewItem[];
  putComments?: ReviewComment[];
  replaceCurrent?: ReviewAtomState;
  checkpoint?: ReviewCheckpoint;
}

export interface ReviewPersistence {
  listMetas(): Promise<ReviewAtomMeta[]>;
  loadCurrent(atomId: AtomId): Promise<ReviewAtomState | null>;
  loadRevisions(atomId: AtomId): Promise<ReviewRevision[]>;
  loadCheckpoint(atomId: AtomId, revisionId: RevisionId): Promise<ReviewCheckpoint | null>;
  findReceipt(commandId: string): Promise<CommandReceipt | null>;
  commit(change: ReviewPersistenceCommit): Promise<void>;
}

export interface MemoryReviewPersistence extends ReviewPersistence {
  stats(): { commits: number; itemWrites: number; commentWrites: number; replacements: number; checkpoints: number };
}

export function createMemoryReviewPersistence(): MemoryReviewPersistence {
  const metas = new Map<AtomId, ReviewAtomMeta>();
  const items = new Map<string, ReviewItem>();
  const comments = new Map<string, ReviewComment>();
  const revisions = new Map<AtomId, ReviewRevision[]>();
  const checkpoints = new Map<string, ReviewCheckpoint>();
  const receipts = new Map<string, CommandReceipt>();
  const counters = { commits: 0, itemWrites: 0, commentWrites: 0, replacements: 0, checkpoints: 0 };

  const itemKey = (atomId: string, itemId: string) => `${atomId}\u0000${itemId}`;
  const commentKey = (atomId: string, commentId: string) => `${atomId}\u0000${commentId}`;
  const checkpointKey = (atomId: string, revisionId: string) => `${atomId}\u0000${revisionId}`;

  return {
    async listMetas() {
      return [...metas.values()].map(cloneState).sort((a, b) => b.updatedAt - a.updatedAt || a.atomId.localeCompare(b.atomId));
    },
    async loadCurrent(atomId) {
      const meta = metas.get(atomId);
      if (!meta) return null;
      return cloneState({
        meta,
        items: [...items.entries()].filter(([key]) => key.startsWith(`${atomId}\u0000`)).map(([, value]) => value),
        comments: [...comments.entries()].filter(([key]) => key.startsWith(`${atomId}\u0000`)).map(([, value]) => value),
      });
    },
    async loadRevisions(atomId) {
      return cloneState(revisions.get(atomId) ?? []);
    },
    async loadCheckpoint(atomId, revisionId) {
      return cloneState(checkpoints.get(checkpointKey(atomId, revisionId)) ?? null);
    },
    async findReceipt(commandId) {
      return cloneState(receipts.get(commandId) ?? null);
    },
    async commit(change) {
      counters.commits += 1;
      metas.set(change.meta.atomId, cloneState(change.meta));
      if (change.replaceCurrent) {
        counters.replacements += 1;
        for (const key of [...items.keys()]) if (key.startsWith(`${change.meta.atomId}\u0000`)) items.delete(key);
        for (const key of [...comments.keys()]) if (key.startsWith(`${change.meta.atomId}\u0000`)) comments.delete(key);
        for (const item of change.replaceCurrent.items) items.set(itemKey(change.meta.atomId, item.itemId), cloneState(item));
        for (const comment of change.replaceCurrent.comments) comments.set(commentKey(change.meta.atomId, comment.commentId), cloneState(comment));
      } else {
        for (const item of change.putItems ?? []) {
          counters.itemWrites += 1;
          items.set(itemKey(change.meta.atomId, item.itemId), cloneState(item));
        }
        for (const comment of change.putComments ?? []) {
          counters.commentWrites += 1;
          comments.set(commentKey(change.meta.atomId, comment.commentId), cloneState(comment));
        }
      }
      const list = revisions.get(change.meta.atomId) ?? [];
      list.push(cloneState(change.revision));
      revisions.set(change.meta.atomId, list);
      if (change.checkpoint) {
        counters.checkpoints += 1;
        checkpoints.set(checkpointKey(change.meta.atomId, change.checkpoint.revisionId), cloneState(change.checkpoint));
      }
      receipts.set(change.receipt.commandId, cloneState(change.receipt));
    },
    stats() { return { ...counters }; },
  };
}

const DATABASE_NAME = "neutron-review-v1";
const DATABASE_VERSION = 1;
const META = "meta";
const ITEMS = "items";
const COMMENTS = "comments";
const REVISIONS = "revisions";
const CHECKPOINTS = "checkpoints";
const RECEIPTS = "receipts";

export function createIndexedDbReviewPersistence(): ReviewPersistence {
  if (typeof indexedDB === "undefined") return createMemoryReviewPersistence();
  const dbPromise = openDatabase();
  return {
    async listMetas() {
      const db = await dbPromise;
      const values = await request<ReviewAtomMeta[]>(db.transaction(META, "readonly").objectStore(META).getAll());
      return values.map(cloneState).sort((a, b) => b.updatedAt - a.updatedAt || a.atomId.localeCompare(b.atomId));
    },
    async loadCurrent(atomId) {
      const db = await dbPromise;
      const transaction = db.transaction([META, ITEMS, COMMENTS], "readonly");
      const meta = await request<ReviewAtomMeta | undefined>(transaction.objectStore(META).get(atomId));
      if (!meta) return null;
      const [allItems, allComments] = await Promise.all([
        request<Array<ReviewItem & { atomId: AtomId }>>(transaction.objectStore(ITEMS).index("atomId").getAll(atomId)),
        request<Array<ReviewComment & { atomId: AtomId }>>(transaction.objectStore(COMMENTS).index("atomId").getAll(atomId)),
      ]);
      await transactionDone(transaction);
      return cloneState({
        meta,
        items: allItems.map(stripAtomId),
        comments: allComments.map(stripAtomId),
      });
    },
    async loadRevisions(atomId) {
      const db = await dbPromise;
      const values = await request<ReviewRevision[]>(db.transaction(REVISIONS, "readonly").objectStore(REVISIONS).index("atomId").getAll(atomId));
      return values.sort((a, b) => a.sequence - b.sequence).map(cloneState);
    },
    async loadCheckpoint(atomId, revisionId) {
      const db = await dbPromise;
      return cloneState(await request<ReviewCheckpoint | undefined>(db.transaction(CHECKPOINTS, "readonly").objectStore(CHECKPOINTS).get([atomId, revisionId])) ?? null);
    },
    async findReceipt(commandId) {
      const db = await dbPromise;
      return cloneState(await request<CommandReceipt | undefined>(db.transaction(RECEIPTS, "readonly").objectStore(RECEIPTS).get(commandId)) ?? null);
    },
    async commit(change) {
      const db = await dbPromise;
      const [existingItemKeys, existingCommentKeys] = change.replaceCurrent
        ? await Promise.all([
            keysForAtom(db, ITEMS, change.meta.atomId),
            keysForAtom(db, COMMENTS, change.meta.atomId),
          ])
        : [[], []];
      const transaction = db.transaction([META, ITEMS, COMMENTS, REVISIONS, CHECKPOINTS, RECEIPTS], "readwrite");
      transaction.objectStore(META).put(change.meta);
      const itemStore = transaction.objectStore(ITEMS);
      const commentStore = transaction.objectStore(COMMENTS);
      if (change.replaceCurrent) {
        for (const key of existingItemKeys) itemStore.delete(key);
        for (const key of existingCommentKeys) commentStore.delete(key);
        for (const item of change.replaceCurrent.items) itemStore.put({ ...item, atomId: change.meta.atomId });
        for (const comment of change.replaceCurrent.comments) commentStore.put({ ...comment, atomId: change.meta.atomId });
      } else {
        for (const item of change.putItems ?? []) itemStore.put({ ...item, atomId: change.meta.atomId });
        for (const comment of change.putComments ?? []) commentStore.put({ ...comment, atomId: change.meta.atomId });
      }
      transaction.objectStore(REVISIONS).put(change.revision);
      if (change.checkpoint) transaction.objectStore(CHECKPOINTS).put(change.checkpoint);
      transaction.objectStore(RECEIPTS).put(change.receipt);
      await transactionDone(transaction);
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "atomId" });
      if (!db.objectStoreNames.contains(ITEMS)) {
        const store = db.createObjectStore(ITEMS, { keyPath: ["atomId", "itemId"] });
        store.createIndex("atomId", "atomId", { unique: false });
      }
      if (!db.objectStoreNames.contains(COMMENTS)) {
        const store = db.createObjectStore(COMMENTS, { keyPath: ["atomId", "commentId"] });
        store.createIndex("atomId", "atomId", { unique: false });
      }
      if (!db.objectStoreNames.contains(REVISIONS)) {
        const store = db.createObjectStore(REVISIONS, { keyPath: ["atomId", "sequence"] });
        store.createIndex("atomId", "atomId", { unique: false });
      }
      if (!db.objectStoreNames.contains(CHECKPOINTS)) db.createObjectStore(CHECKPOINTS, { keyPath: ["atomId", "revisionId"] });
      if (!db.objectStoreNames.contains(RECEIPTS)) db.createObjectStore(RECEIPTS, { keyPath: "commandId" });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("Failed to open Review database"));
    opening.onblocked = () => reject(new Error("Review database is blocked"));
  });
}

async function keysForAtom(db: IDBDatabase, storeName: string, atomId: AtomId): Promise<IDBValidKey[]> {
  const transaction = db.transaction(storeName, "readonly");
  const keys = await request<IDBValidKey[]>(transaction.objectStore(storeName).index("atomId").getAllKeys(atomId));
  await transactionDone(transaction);
  return keys;
}

function stripAtomId<T extends { atomId: AtomId }>(value: T): Omit<T, "atomId"> {
  const { atomId: _atomId, ...rest } = value;
  return rest;
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("Review IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Review IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Review IndexedDB transaction aborted"));
  });
}
