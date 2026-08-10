import type { JsonValue, NodeId } from "../contracts/common.ts";
import type { AtomDescriptor } from "../contracts/associations.ts";
import type { ResourceRef } from "../contracts/authorization.ts";
import type { FsNode, FsService } from "../contracts/fs.ts";
import type {
  PublishResourceOptions,
  PublishedResource,
  SharedResourceProvider,
} from "../contracts/sharing.ts";
import { computeContentRoot, sha256Hex, verifyChunk, verifyContentRoot } from "./hash.ts";
import {
  DEFAULT_STABLE_CHUNK_SIZE,
  InvalidPublishedResourceError,
  MAX_STABLE_CHUNK_SIZE,
  PLASMON_ATOM_NAMESPACE,
  PLASMON_FILE_NAMESPACE,
  ResourceIntegrityError,
  RevisionConflictError,
  UnsupportedPublishedResourceError,
  type ProviderAtomSnapshot,
  type ProviderChunkRef,
  type ProviderResourceIdentity,
  type ProviderResourceRecord,
  type ProviderRevisionRecord,
  type ProviderSnapshotMetadata,
} from "./model.ts";
import {
  contractResourceRefToLocator,
  revisionToContractResourceRef,
  type ProviderResourceLocator,
} from "./resourceRefBoundary.ts";
import type { SharedResourceStore } from "./store.ts";

const SHARED_SOURCE_METADATA_KEY = "sharedSource";

function asRecord(value: JsonValue | undefined): { [key: string]: JsonValue } | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as { [key: string]: JsonValue }
    : null;
}

function requireString(record: { [key: string]: JsonValue }, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new InvalidPublishedResourceError(`Atom metadata is missing ${key}`);
  return value;
}

function requireNumber(record: { [key: string]: JsonValue }, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new InvalidPublishedResourceError(`Atom metadata is missing ${key}`);
  }
  return value;
}

function parseAtomSnapshot(node: FsNode): ProviderAtomSnapshot {
  const atom = asRecord(node.metadata.atom);
  if (!atom) throw new InvalidPublishedResourceError("Atom node is missing metadata.atom");
  if (atom.format !== "plasmon.atom" || atom.version !== 1) {
    throw new InvalidPublishedResourceError("Atom metadata format/version is unsupported");
  }

  const snapshot: ProviderAtomSnapshot = {
    format: "plasmon.atom",
    version: 1,
    atomId: requireString(atom, "atomId"),
    handlerId: requireString(atom, "handlerId"),
    atomType: requireString(atom, "atomType"),
    schemaVersion: requireNumber(atom, "schemaVersion"),
  };
  if (typeof atom.title === "string" && atom.title.trim()) snapshot.title = atom.title;
  return snapshot;
}

function identityForNode(node: FsNode): {
  identity: ProviderResourceIdentity;
  resourceType: string;
  snapshot: ProviderSnapshotMetadata;
} {
  if (node.kind === "directory") {
    throw new UnsupportedPublishedResourceError("Directory publication is not part of provider Phase A");
  }

  if (node.kind === "atom") {
    const atom = parseAtomSnapshot(node);
    return {
      identity: { namespace: PLASMON_ATOM_NAMESPACE, resourceId: atom.atomId },
      resourceType: atom.atomType,
      snapshot: {
        displayName: node.name,
        kind: node.kind,
        ...(node.mime ? { mime: node.mime } : {}),
        atom,
      },
    };
  }

  return {
    identity: { namespace: PLASMON_FILE_NAMESPACE, resourceId: node.id },
    resourceType: node.mime ?? node.kind,
    snapshot: {
      displayName: node.name,
      kind: node.kind,
      ...(node.mime ? { mime: node.mime } : {}),
    },
  };
}

function makeImportedMetadata(revision: ProviderRevisionRecord): Record<string, JsonValue> {
  const sharedSource: JsonValue = {
    format: "plasmon.shared-source",
    version: 1,
    namespace: revision.identity.namespace,
    resourceId: revision.identity.resourceId,
    resourceType: revision.resourceType,
    revision: revision.revision,
  };

  if (!revision.snapshot.atom) return { [SHARED_SOURCE_METADATA_KEY]: sharedSource };

  const sourceAtom = revision.snapshot.atom;
  const atom: AtomDescriptor = {
    ...sourceAtom,
    atomId: crypto.randomUUID(),
  };
  return {
    atom: atom as unknown as JsonValue,
    [SHARED_SOURCE_METADATA_KEY]: sharedSource,
  };
}

async function readVerifiedRevision(
  store: SharedResourceStore,
  locator: ProviderResourceLocator,
): Promise<ProviderRevisionRecord> {
  const revision = await store.getRevision(locator.identity, locator.revision);
  if (!revision) throw new InvalidPublishedResourceError("Published resource revision does not exist");
  if (revision.resourceType !== locator.resourceType) {
    throw new InvalidPublishedResourceError("Published resource type does not match the stored revision");
  }
  await verifyContentRoot(revision.byteLength, revision.chunks, revision.contentRootHash);
  return revision;
}

export interface ProviderResourceDescription {
  record: ProviderResourceRecord;
  revision: ProviderRevisionRecord;
}

/**
 * Resource-scoped provider operations intended to be bound later from MTN's
 * trusted AuthorizationContext. This object contains no rights, grant, lease,
 * provider-scope, or bearer-token input. The exact resource identity is captured
 * when the handle is created.
 */
export class ProviderResourceHandle {
  private readonly store: SharedResourceStore;
  private readonly identity: ProviderResourceIdentity;

  constructor(store: SharedResourceStore, identity: ProviderResourceIdentity) {
    this.store = store;
    this.identity = { ...identity };
  }

  async describe(): Promise<ProviderResourceDescription> {
    const record = await this.store.describe(this.identity);
    if (!record) throw new InvalidPublishedResourceError("Published resource does not exist");
    const revision = await this.store.getRevision(this.identity, record.currentRevision);
    if (!revision) throw new ResourceIntegrityError("Published resource current revision is missing");
    await verifyContentRoot(revision.byteLength, revision.chunks, revision.contentRootHash);
    return { record, revision };
  }

  async readChunk(index: number, revision?: string): Promise<Uint8Array> {
    if (!Number.isInteger(index) || index < 0) throw new InvalidPublishedResourceError("Chunk index is invalid");
    const current = await this.store.getRevision(this.identity, revision);
    if (!current) throw new InvalidPublishedResourceError("Published resource revision does not exist");
    const ref = current.chunks[index];
    if (!ref) throw new InvalidPublishedResourceError("Chunk index is out of range");
    const bytes = await this.store.getChunk(ref.hash);
    if (!bytes) throw new ResourceIntegrityError(`Published chunk ${ref.hash} is missing`);
    await verifyChunk(ref, bytes);
    return bytes;
  }

  async readAll(revision?: string): Promise<Uint8Array> {
    const current = await this.store.getRevision(this.identity, revision);
    if (!current) throw new InvalidPublishedResourceError("Published resource revision does not exist");
    await verifyContentRoot(current.byteLength, current.chunks, current.contentRootHash);
    const result = new Uint8Array(current.byteLength);
    let offset = 0;
    for (const ref of current.chunks) {
      const bytes = await this.store.getChunk(ref.hash);
      if (!bytes) throw new ResourceIntegrityError(`Published chunk ${ref.hash} is missing`);
      await verifyChunk(ref, bytes);
      result.set(bytes, offset);
      offset += bytes.length;
    }
    return result;
  }

  async write(expectedRevision: string, data: Uint8Array, now = Date.now()): Promise<ProviderRevisionRecord> {
    if (!/^[1-9][0-9]*$/.test(expectedRevision)) {
      throw new InvalidPublishedResourceError(`Expected revision is malformed: ${expectedRevision}`);
    }
    const current = await this.store.getRevision(this.identity, expectedRevision);
    if (!current) {
      const latest = await this.store.describe(this.identity);
      throw new RevisionConflictError(expectedRevision, latest?.currentRevision ?? null);
    }

    const chunkRefs: ProviderChunkRef[] = [];
    const chunkSize = DEFAULT_STABLE_CHUNK_SIZE;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const bytes = data.slice(offset, Math.min(data.length, offset + chunkSize));
      const hash = await sha256Hex(bytes);
      if (!(await this.store.hasChunk(hash))) await this.store.putChunk(hash, bytes);
      chunkRefs.push({ hash, size: bytes.length });
    }
    const root = await computeContentRoot(data.length, chunkRefs);
    return this.store.commitRevision({
      identity: this.identity,
      resourceType: current.resourceType,
      expectedRevision,
      byteLength: data.length,
      contentRootHash: root,
      chunks: chunkRefs,
      snapshot: current.snapshot,
      createdAt: now,
    });
  }
}

export interface StableSharedResourceProviderOptions {
  /** Production default is 1 MiB. Smaller values are useful for focused tests. */
  chunkSize?: number;
  now?: () => number;
}

export class StableSharedResourceProvider implements SharedResourceProvider {
  private readonly fs: FsService;
  private readonly store: SharedResourceStore;
  private readonly chunkSize: number;
  private readonly now: () => number;

  constructor(fs: FsService, store: SharedResourceStore, options: StableSharedResourceProviderOptions = {}) {
    this.fs = fs;
    this.store = store;
    this.chunkSize = options.chunkSize ?? DEFAULT_STABLE_CHUNK_SIZE;
    this.now = options.now ?? Date.now;
    if (!Number.isInteger(this.chunkSize) || this.chunkSize <= 0 || this.chunkSize > MAX_STABLE_CHUNK_SIZE) {
      throw new RangeError(`Shared-resource chunk size must be between 1 and ${MAX_STABLE_CHUNK_SIZE} bytes`);
    }
  }

  async publish(nodeId: NodeId, options: PublishResourceOptions = { mode: "snapshot" }): Promise<PublishedResource> {
    if (options.mode !== "snapshot") throw new UnsupportedPublishedResourceError(`Unsupported publish mode: ${String(options.mode)}`);
    await this.store.schemaVersion();

    const snapshotRevision = await this.fs.revision();
    const node = await this.fs.stat(nodeId);
    const { identity, resourceType, snapshot } = identityForNode(node);
    const before = await this.store.describe(identity);
    const expectedRevision = before?.currentRevision ?? null;
    const chunks: ProviderChunkRef[] = [];
    let offset = 0;

    while (offset < node.size) {
      const requested = Math.min(this.chunkSize, node.size - offset);
      const bytes = await this.fs.read(node.id, { offset, length: requested });
      if (bytes.length !== requested) {
        throw new ResourceIntegrityError(`Filesystem snapshot ended at ${offset + bytes.length}; expected ${node.size} bytes`);
      }
      const hash = await sha256Hex(bytes);
      if (!(await this.store.hasChunk(hash))) await this.store.putChunk(hash, bytes);
      chunks.push({ hash, size: bytes.length });
      offset += bytes.length;
    }

    const root = await computeContentRoot(node.size, chunks);
    const completedRevision = await this.fs.revision();
    if (completedRevision !== snapshotRevision) {
      throw new ResourceIntegrityError(
        `Filesystem source changed during publication snapshot: revision ${snapshotRevision.toString()} -> ${completedRevision.toString()}; no provider revision was committed`,
      );
    }

    const revision = await this.store.commitRevision({
      identity,
      resourceType,
      expectedRevision,
      byteLength: node.size,
      contentRootHash: root,
      chunks,
      snapshot,
      createdAt: this.now(),
    });

    return {
      nodeId,
      resource: revisionToContractResourceRef(revision),
      createdAt: revision.createdAt,
    };
  }

  async importResource(resource: ResourceRef, destination: NodeId): Promise<FsNode> {
    const destinationNode = await this.fs.stat(destination);
    if (destinationNode.kind !== "directory") throw new InvalidPublishedResourceError("Import destination must be a directory");

    const locator = contractResourceRefToLocator(resource);
    const revision = await readVerifiedRevision(this.store, locator);
    const metadata = makeImportedMetadata(revision);
    let created: FsNode | null = null;

    try {
      created = await this.fs.createFile(destination, revision.snapshot.displayName, {
        kind: revision.snapshot.kind,
        ...(revision.snapshot.mime ? { mime: revision.snapshot.mime } : {}),
        metadata,
      });

      let offset = 0;
      for (const ref of revision.chunks) {
        const bytes = await this.store.getChunk(ref.hash);
        if (!bytes) throw new ResourceIntegrityError(`Published chunk ${ref.hash} is missing`);
        await verifyChunk(ref, bytes);
        await this.fs.write(created.id, bytes, { offset, truncate: offset === 0 });
        offset += bytes.length;
      }
      if (revision.chunks.length === 0) {
        await this.fs.write(created.id, new Uint8Array(), { truncate: true });
      }
      return this.fs.stat(created.id);
    } catch (error) {
      if (created) await this.fs.remove(created.id).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Internal provider-only access. This is deliberately NOT an authorization
   * boundary: the ResourceRef is only a storage locator. Do not expose this
   * method to cross-AppScope callers. Phase B must construct a resource-scoped
   * handle only after MTN supplies trusted authorization context.
   */
  openInternalResource(resource: ResourceRef): ProviderResourceHandle {
    const locator = contractResourceRefToLocator(resource);
    return new ProviderResourceHandle(this.store, locator.identity);
  }

  async describePublished(resource: ResourceRef): Promise<ProviderResourceDescription> {
    const locator = contractResourceRefToLocator(resource);
    const revision = await readVerifiedRevision(this.store, locator);
    const record = await this.store.describe(locator.identity);
    if (!record) throw new InvalidPublishedResourceError("Published resource does not exist");
    return { record, revision };
  }
}
