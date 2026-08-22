export interface ReviewSubmission {
  atomId: string;
  revisionId: string;
  submittedAt: number;
  /** Optional Files portability metadata. Core Submit does not require Files. */
  path?: string;
  etag?: string;
}

export interface ReviewSubmissionStore {
  load(atomId: string): Promise<ReviewSubmission | null>;
  save(submission: ReviewSubmission): Promise<void>;
}

export function createMemoryReviewSubmissionStore(): ReviewSubmissionStore {
  const submissions = new Map<string, ReviewSubmission>();
  return {
    async load(atomId) {
      return clone(submissions.get(atomId) ?? null);
    },
    async save(submission) {
      submissions.set(submission.atomId, clone(submission));
    },
  };
}

// Keep the existing database/version so this code release does not invent a
// persistence migration. Older records with path/etag remain valid because
// those fields are now optional compatibility metadata.
const DATABASE_NAME = "neutron-review-submissions-v1";
const DATABASE_VERSION = 1;
const SUBMISSIONS = "submissions";

export function createIndexedDbReviewSubmissionStore(): ReviewSubmissionStore {
  if (typeof indexedDB === "undefined") return createMemoryReviewSubmissionStore();
  const dbPromise = openDatabase();
  return {
    async load(atomId) {
      const db = await dbPromise;
      const value = await request<ReviewSubmission | undefined>(db.transaction(SUBMISSIONS, "readonly").objectStore(SUBMISSIONS).get(atomId));
      return clone(value ?? null);
    },
    async save(submission) {
      const db = await dbPromise;
      const transaction = db.transaction(SUBMISSIONS, "readwrite");
      transaction.objectStore(SUBMISSIONS).put(submission);
      await transactionDone(transaction);
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(SUBMISSIONS)) db.createObjectStore(SUBMISSIONS, { keyPath: "atomId" });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("Failed to open Review submission database"));
    opening.onblocked = () => reject(new Error("Review submission database is blocked"));
  });
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("Review submission IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Review submission IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Review submission IndexedDB transaction aborted"));
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
