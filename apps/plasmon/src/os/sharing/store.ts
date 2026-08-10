import {
  ChunkIntegrityError,
  ProviderSchemaVersionError,
  ResourceIntegrityError,
  RevisionConflictError,
  SHARING_PROVIDER_SCHEMA_VERSION,
  type ProviderChunkRef,
  type ProviderCommitRequest,
  type ProviderResourceIdentity,
  type ProviderResourceRecord,
  type ProviderRevisionRecord,
} from "./model.ts";
import {
  bytesToHex,
  computeContentRoot,
  hexToBytes,
  sha256Hex,
  verifyChunk,
  verifyContentRoot,
} from "./hash.ts";

export interface SharedResourceStore {
  schemaVersion(): Promise<number>;
  hasChunk(hash: string): Promise<boolean>;
  putChunk(hash: string, bytes: Uint8Array): Promise<"stored" | "deduplicated">;
  getChunk(hash: string): Promise<Uint8Array | null>;
  describe(identity: ProviderResourceIdentity): Promise<ProviderResourceRecord | null>;
  getRevision(identity: ProviderResourceIdentity, revision?: string): Promise<ProviderRevisionRecord | null>;
  commitRevision(request: ProviderCommitRequest): Promise<ProviderRevisionRecord>;
}

export interface MemoryResourceState {
  record: ProviderResourceRecord;
  revisions: Map<string, ProviderRevisionRecord>;
}

export interface MemorySharedResourceState {
  schemaVersion: number;
  chunks: Map<string, Uint8Array>;
  resources: Map<string, MemoryResourceState>;
}

export function createMemorySharedResourceState(): MemorySharedResourceState {
  return {
    schemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
    chunks: new Map(),
    resources: new Map(),
  };
}

function identityKey(identity: ProviderResourceIdentity): string {
  return `${identity.namespace.length}:${identity.namespace}${identity.resourceId}`;
}

function cloneIdentity(identity: ProviderResourceIdentity): ProviderResourceIdentity {
  return { namespace: identity.namespace, resourceId: identity.resourceId };
}

function cloneChunkRef(chunk: ProviderChunkRef): ProviderChunkRef {
  return { hash: chunk.hash, size: chunk.size };
}

function cloneRevision(revision: ProviderRevisionRecord): ProviderRevisionRecord {
  return {
    ...revision,
    identity: cloneIdentity(revision.identity),
    chunks: revision.chunks.map(cloneChunkRef),
    snapshot: {
      ...revision.snapshot,
      ...(revision.snapshot.atom ? { atom: { ...revision.snapshot.atom } } : {}),
    },
  };
}

function cloneRecord(record: ProviderResourceRecord): ProviderResourceRecord {
  return { ...record, identity: cloneIdentity(record.identity) };
}

function parseRevision(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new ResourceIntegrityError(`Invalid revision: ${value}`);
  return BigInt(value);
}

export class MemorySharedResourceStore implements SharedResourceStore {
  private readonly state: MemorySharedResourceState;

  constructor(state: MemorySharedResourceState = createMemorySharedResourceState()) {
    if (state.schemaVersion !== SHARING_PROVIDER_SCHEMA_VERSION) {
      throw new ProviderSchemaVersionError(state.schemaVersion);
    }
    this.state = state;
  }

  async schemaVersion(): Promise<number> {
    return this.state.schemaVersion;
  }

  async hasChunk(hash: string): Promise<boolean> {
    hexToBytes(hash);
    return this.state.chunks.has(hash);
  }

  async putChunk(hash: string, bytes: Uint8Array): Promise<"stored" | "deduplicated"> {
    hexToBytes(hash);
    const actual = await sha256Hex(bytes);
    if (actual !== hash) {
      throw new ChunkIntegrityError(`Chunk hash mismatch on upload: expected ${hash}, received ${actual}`);
    }

    const existing = this.state.chunks.get(hash);
    if (existing) {
      const existingHash = await sha256Hex(existing);
      if (existingHash !== hash) {
        throw new ChunkIntegrityError(`Stored chunk ${hash} failed integrity verification`);
      }
      return "deduplicated";
    }

    this.state.chunks.set(hash, bytes.slice());
    return "stored";
  }

  async getChunk(hash: string): Promise<Uint8Array | null> {
    hexToBytes(hash);
    const bytes = this.state.chunks.get(hash);
    if (!bytes) return null;
    const actual = await sha256Hex(bytes);
    if (actual !== hash) {
      throw new ChunkIntegrityError(`Stored chunk ${hash} failed integrity verification`);
    }
    return bytes.slice();
  }

  async describe(identity: ProviderResourceIdentity): Promise<ProviderResourceRecord | null> {
    const resource = this.state.resources.get(identityKey(identity));
    return resource ? cloneRecord(resource.record) : null;
  }

  async getRevision(identity: ProviderResourceIdentity, revision?: string): Promise<ProviderRevisionRecord | null> {
    const resource = this.state.resources.get(identityKey(identity));
    if (!resource) return null;
    const selected = revision ?? resource.record.currentRevision;
    const item = resource.revisions.get(selected);
    return item ? cloneRevision(item) : null;
  }

  async commitRevision(request: ProviderCommitRequest): Promise<ProviderRevisionRecord> {
    if (!Number.isSafeInteger(request.byteLength) || request.byteLength < 0) {
      throw new ResourceIntegrityError(`Invalid byte length: ${request.byteLength}`);
    }
    if (!request.resourceType.trim()) throw new ResourceIntegrityError("Resource type is required");
    if (!Number.isSafeInteger(request.createdAt) || request.createdAt < 0) {
      throw new ResourceIntegrityError(`Invalid creation timestamp: ${request.createdAt}`);
    }

    const key = identityKey(request.identity);
    const existing = this.state.resources.get(key);
    const actualRevision = existing?.record.currentRevision ?? null;
    if (request.expectedRevision !== actualRevision) {
      throw new RevisionConflictError(request.expectedRevision, actualRevision);
    }

    for (const ref of request.chunks) {
      const bytes = await this.getChunk(ref.hash);
      if (!bytes) throw new ChunkIntegrityError(`Missing chunk ${ref.hash}`);
      await verifyChunk(ref, bytes);
    }
    await verifyContentRoot(request.byteLength, request.chunks, request.contentRootHash);

    const next = actualRevision === null ? 1n : parseRevision(actualRevision) + 1n;
    const revision: ProviderRevisionRecord = {
      schemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
      identity: cloneIdentity(request.identity),
      resourceType: request.resourceType,
      revision: next.toString(),
      byteLength: request.byteLength,
      contentRootHash: request.contentRootHash,
      chunks: request.chunks.map(cloneChunkRef),
      snapshot: {
        ...request.snapshot,
        ...(request.snapshot.atom ? { atom: { ...request.snapshot.atom } } : {}),
      },
      createdAt: request.createdAt,
    };

    if (existing) {
      existing.record = {
        ...existing.record,
        resourceType: request.resourceType,
        currentRevision: revision.revision,
        updatedAt: request.createdAt,
      };
      existing.revisions.set(revision.revision, cloneRevision(revision));
    } else {
      const record: ProviderResourceRecord = {
        schemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
        identity: cloneIdentity(request.identity),
        resourceType: request.resourceType,
        currentRevision: revision.revision,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
      };
      this.state.resources.set(key, {
        record,
        revisions: new Map([[revision.revision, cloneRevision(revision)]]),
      });
    }

    return cloneRevision(revision);
  }

  /** Test/diagnostic snapshot. It intentionally contains no authorization material. */
  exportSerializableState(): unknown {
    return {
      schemaVersion: this.state.schemaVersion,
      chunks: [...this.state.chunks.entries()].map(([hash, bytes]) => ({ hash, bytes: [...bytes] })),
      resources: [...this.state.resources.values()].map(({ record, revisions }) => ({
        record: cloneRecord(record),
        revisions: [...revisions.values()].map(cloneRevision),
      })),
    };
  }

  stats(): { resourceCount: number; revisionCount: number; chunkCount: number; totalChunkBytes: number } {
    let revisionCount = 0;
    for (const resource of this.state.resources.values()) revisionCount += resource.revisions.size;
    let totalChunkBytes = 0;
    for (const chunk of this.state.chunks.values()) totalChunkBytes += chunk.length;
    return {
      resourceCount: this.state.resources.size,
      revisionCount,
      chunkCount: this.state.chunks.size,
      totalChunkBytes,
    };
  }
}

/**
 * Narrow transport seam for the Plasmon backend stable-memory methods. The
 * concrete Neutron self-call implementation belongs to composition/integration;
 * provider storage semantics remain here.
 */
export interface StableMemorySharingTransport {
  schemaVersion(): Promise<number>;
  hasChunk(hash: Uint8Array): Promise<boolean>;
  putChunk(hash: Uint8Array, bytes: Uint8Array): Promise<"stored" | "deduplicated">;
  getChunk(hash: Uint8Array): Promise<Uint8Array | null>;
  describe(identity: ProviderResourceIdentity): Promise<ProviderResourceRecord | null>;
  getRevision(identity: ProviderResourceIdentity, revision?: string): Promise<ProviderRevisionRecord | null>;
  commitRevision(request: Omit<ProviderCommitRequest, "contentRootHash" | "chunks"> & {
    contentRootHash: Uint8Array;
    chunks: readonly { hash: Uint8Array; size: number }[];
  }): Promise<ProviderRevisionRecord>;
}

export class StableMemorySharedResourceStore implements SharedResourceStore {
  private readonly transport: StableMemorySharingTransport;
  private schemaChecked = false;

  constructor(transport: StableMemorySharingTransport) {
    this.transport = transport;
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaChecked) return;
    const version = await this.transport.schemaVersion();
    if (version !== SHARING_PROVIDER_SCHEMA_VERSION) throw new ProviderSchemaVersionError(version);
    this.schemaChecked = true;
  }

  async schemaVersion(): Promise<number> {
    await this.ensureSchema();
    return SHARING_PROVIDER_SCHEMA_VERSION;
  }

  async hasChunk(hash: string): Promise<boolean> {
    await this.ensureSchema();
    return this.transport.hasChunk(hexToBytes(hash));
  }

  async putChunk(hash: string, bytes: Uint8Array): Promise<"stored" | "deduplicated"> {
    await this.ensureSchema();
    const actual = await sha256Hex(bytes);
    if (actual !== hash) throw new ChunkIntegrityError(`Chunk hash mismatch before stable-memory upload: ${hash}`);
    return this.transport.putChunk(hexToBytes(hash), bytes);
  }

  async getChunk(hash: string): Promise<Uint8Array | null> {
    await this.ensureSchema();
    const bytes = await this.transport.getChunk(hexToBytes(hash));
    if (!bytes) return null;
    const actual = await sha256Hex(bytes);
    if (actual !== hash) throw new ChunkIntegrityError(`Stable-memory chunk ${hash} failed integrity verification`);
    return bytes;
  }

  async describe(identity: ProviderResourceIdentity): Promise<ProviderResourceRecord | null> {
    await this.ensureSchema();
    return this.transport.describe(identity);
  }

  async getRevision(identity: ProviderResourceIdentity, revision?: string): Promise<ProviderRevisionRecord | null> {
    await this.ensureSchema();
    const item = await this.transport.getRevision(identity, revision);
    if (!item) return null;
    await verifyContentRoot(item.byteLength, item.chunks, item.contentRootHash);
    return item;
  }

  async commitRevision(request: ProviderCommitRequest): Promise<ProviderRevisionRecord> {
    await this.ensureSchema();
    await verifyContentRoot(request.byteLength, request.chunks, request.contentRootHash);
    return this.transport.commitRevision({
      ...request,
      contentRootHash: hexToBytes(request.contentRootHash),
      chunks: request.chunks.map((chunk) => ({ hash: hexToBytes(chunk.hash), size: chunk.size })),
    });
  }
}

/** Helper for transports that expose backend digest bytes. */
export function stableDigestToHex(value: Uint8Array): string {
  if (value.length !== 32) throw new ChunkIntegrityError(`Expected 32-byte SHA-256 digest, got ${value.length}`);
  return bytesToHex(value);
}

/** Recompute a root in transport tests without trusting backend locators. */
export async function stableRootFromChunks(byteLength: number, chunks: readonly { hash: Uint8Array; size: number }[]): Promise<string> {
  return computeContentRoot(byteLength, chunks.map((chunk) => ({ hash: stableDigestToHex(chunk.hash), size: chunk.size })));
}
