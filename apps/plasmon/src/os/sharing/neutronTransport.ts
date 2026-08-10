import { querySelf, updateSelf, type SelfCallValue } from "neutron-tools/app";
import { bytesToHex, hexToBytes } from "./hash.ts";
import {
  ChunkIntegrityError,
  ProviderSchemaVersionError,
  ResourceIntegrityError,
  RevisionConflictError,
  SHARING_PROVIDER_SCHEMA_VERSION,
  type ProviderCommitRequest,
  type ProviderResourceIdentity,
  type ProviderResourceRecord,
  type ProviderRevisionRecord,
  type ProviderSnapshotMetadata,
} from "./model.ts";
import { StableMemorySharedResourceStore, type StableMemorySharingTransport } from "./store.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}

function asText(value: unknown, field: string): string {
  if (typeof value !== "string") throw new ResourceIntegrityError(`Backend field ${field} is not text`);
  return value;
}

function asSafeInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^[0-9]+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ResourceIntegrityError(`Backend field ${field} is not a safe unsigned integer`);
  }
  return parsed;
}

function asDigest(value: unknown, field: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new ChunkIntegrityError(`Backend field ${field} is not a 32-byte SHA-256 digest`);
  }
  return value;
}

function unwrapOptional(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) return value[0];
  }
  return value;
}

function variant(value: unknown): { tag: string; payload: unknown } {
  if (typeof value === "string") return { tag: value.replace(/^#/, ""), payload: null };
  if (!isObject(value)) throw new ResourceIntegrityError("Backend variant response is malformed");
  if (typeof value.tag === "string") return { tag: value.tag.replace(/^#/, ""), payload: value.value ?? null };
  const keys = Object.keys(value);
  if (keys.length !== 1) throw new ResourceIntegrityError("Backend variant response is malformed");
  return { tag: keys[0].replace(/^#/, ""), payload: value[keys[0]] };
}

function parseAtom(value: unknown): ProviderSnapshotMetadata["atom"] {
  const optional = unwrapOptional(value);
  if (optional === null) return undefined;
  if (!isObject(optional)) throw new ResourceIntegrityError("Backend atom snapshot is malformed");
  const titleValue = unwrapOptional(optional.title);
  return {
    format: "plasmon.atom",
    version: asSafeInteger(optional.version, "snapshot.atom.version") as 1,
    atomId: asText(optional.atomId, "snapshot.atom.atomId"),
    handlerId: asText(optional.handlerId, "snapshot.atom.handlerId"),
    atomType: asText(optional.atomType, "snapshot.atom.atomType"),
    schemaVersion: asSafeInteger(optional.schemaVersion, "snapshot.atom.schemaVersion"),
    ...(typeof titleValue === "string" ? { title: titleValue } : {}),
  };
}

function parseSnapshot(value: unknown): ProviderSnapshotMetadata {
  if (!isObject(value)) throw new ResourceIntegrityError("Backend snapshot is malformed");
  const kind = asText(value.kind, "snapshot.kind");
  if (kind !== "file" && kind !== "shortcut" && kind !== "atom") {
    throw new ResourceIntegrityError(`Backend snapshot kind is unsupported: ${kind}`);
  }
  const mime = unwrapOptional(value.mime);
  const atom = parseAtom(value.atom);
  return {
    displayName: asText(value.displayName, "snapshot.displayName"),
    kind,
    ...(typeof mime === "string" ? { mime } : {}),
    ...(atom ? { atom } : {}),
  };
}

function parseChunks(value: unknown): { hash: string; size: number }[] {
  if (!Array.isArray(value)) throw new ResourceIntegrityError("Backend chunk manifest is malformed");
  return value.map((item, index) => {
    if (!isObject(item)) throw new ResourceIntegrityError(`Backend chunk ${index} is malformed`);
    return {
      hash: bytesToHex(asDigest(item.hash, `chunks[${index}].hash`)),
      size: asSafeInteger(item.size, `chunks[${index}].size`),
    };
  });
}

function parseRevision(value: unknown): ProviderRevisionRecord {
  if (!isObject(value)) throw new ResourceIntegrityError("Backend revision is malformed");
  const schemaVersion = asSafeInteger(value.schemaVersion, "revision.schemaVersion");
  if (schemaVersion !== SHARING_PROVIDER_SCHEMA_VERSION) throw new ProviderSchemaVersionError(schemaVersion);
  const revision = asSafeInteger(value.revision, "revision.revision");
  if (revision < 1) throw new ResourceIntegrityError("Backend revision must be positive");
  return {
    schemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
    identity: {
      namespace: asText(value.namespace, "revision.namespace"),
      resourceId: asText(value.resourceId, "revision.resourceId"),
    },
    resourceType: asText(value.resourceType, "revision.resourceType"),
    revision: String(revision),
    byteLength: asSafeInteger(value.byteLength, "revision.byteLength"),
    contentRootHash: bytesToHex(asDigest(value.contentRootHash, "revision.contentRootHash")),
    chunks: parseChunks(value.chunks),
    snapshot: parseSnapshot(value.snapshot),
    createdAt: asSafeInteger(value.createdAt, "revision.createdAt"),
  };
}

function parseRecord(value: unknown): ProviderResourceRecord {
  if (!isObject(value)) throw new ResourceIntegrityError("Backend resource summary is malformed");
  const schemaVersion = asSafeInteger(value.schemaVersion, "resource.schemaVersion");
  if (schemaVersion !== SHARING_PROVIDER_SCHEMA_VERSION) throw new ProviderSchemaVersionError(schemaVersion);
  const revision = asSafeInteger(value.currentRevision, "resource.currentRevision");
  if (revision < 1) throw new ResourceIntegrityError("Backend current revision must be positive");
  return {
    schemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
    identity: {
      namespace: asText(value.namespace, "resource.namespace"),
      resourceId: asText(value.resourceId, "resource.resourceId"),
    },
    resourceType: asText(value.resourceType, "resource.resourceType"),
    currentRevision: String(revision),
    createdAt: asSafeInteger(value.createdAt, "resource.createdAt"),
    updatedAt: asSafeInteger(value.updatedAt, "resource.updatedAt"),
  };
}

function snapshotToBackend(snapshot: ProviderSnapshotMetadata): SelfCallValue {
  return {
    displayName: snapshot.displayName,
    kind: snapshot.kind,
    mime: snapshot.mime ?? null,
    atom: snapshot.atom ? {
      format: snapshot.atom.format,
      version: snapshot.atom.version,
      atomId: snapshot.atom.atomId,
      handlerId: snapshot.atom.handlerId,
      atomType: snapshot.atom.atomType,
      schemaVersion: snapshot.atom.schemaVersion,
      title: snapshot.atom.title ?? null,
    } : null,
  };
}

function backendRevisionArgument(value: string | null): SelfCallValue {
  if (value === null) return null;
  if (!/^[1-9][0-9]*$/.test(value)) throw new ResourceIntegrityError(`Invalid revision: ${value}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ResourceIntegrityError(`Revision exceeds Neutron safe integer range: ${value}`);
  return parsed;
}

export class NeutronStableMemorySharingTransport implements StableMemorySharingTransport {
  async schemaVersion(): Promise<number> {
    return asSafeInteger(await querySelf<SelfCallValue>("sharing_schema_version"), "schemaVersion");
  }

  async hasChunk(hash: Uint8Array): Promise<boolean> {
    const value = await querySelf<SelfCallValue>("sharing_has_chunk", [hash]);
    if (typeof value !== "boolean") throw new ResourceIntegrityError("sharing_has_chunk returned a non-boolean value");
    return value;
  }

  async putChunk(hash: Uint8Array, bytes: Uint8Array): Promise<"stored" | "deduplicated"> {
    const response = variant(await updateSelf<SelfCallValue>("sharing_put_chunk", [hash, bytes]));
    if (response.tag === "stored") return "stored";
    if (response.tag === "deduplicated") return "deduplicated";
    if (response.tag === "err") throw new ChunkIntegrityError(String(response.payload ?? "stable-memory chunk upload failed"));
    throw new ResourceIntegrityError(`Unknown sharing_put_chunk response: ${response.tag}`);
  }

  async getChunk(hash: Uint8Array): Promise<Uint8Array | null> {
    const value = unwrapOptional(await querySelf<SelfCallValue>("sharing_get_chunk", [hash]));
    if (value === null) return null;
    if (!(value instanceof Uint8Array)) throw new ResourceIntegrityError("sharing_get_chunk returned non-binary data");
    return value;
  }

  async describe(identity: ProviderResourceIdentity): Promise<ProviderResourceRecord | null> {
    const value = unwrapOptional(await querySelf<SelfCallValue>("sharing_describe", [identity.namespace, identity.resourceId]));
    return value === null ? null : parseRecord(value);
  }

  async getRevision(identity: ProviderResourceIdentity, revision?: string): Promise<ProviderRevisionRecord | null> {
    const value = unwrapOptional(await querySelf<SelfCallValue>("sharing_get_revision", [
      identity.namespace,
      identity.resourceId,
      backendRevisionArgument(revision ?? null),
    ]));
    return value === null ? null : parseRevision(value);
  }

  async commitRevision(request: Omit<ProviderCommitRequest, "contentRootHash" | "chunks"> & {
    contentRootHash: Uint8Array;
    chunks: readonly { hash: Uint8Array; size: number }[];
  }): Promise<ProviderRevisionRecord> {
    const response = variant(await updateSelf<SelfCallValue>("sharing_commit_revision", [
      request.identity.namespace,
      request.identity.resourceId,
      request.resourceType,
      backendRevisionArgument(request.expectedRevision),
      request.byteLength,
      request.contentRootHash,
      request.chunks.map((chunk) => ({ hash: chunk.hash, size: chunk.size })),
      snapshotToBackend(request.snapshot),
      request.createdAt,
    ]));

    if (response.tag === "ok") return parseRevision(response.payload);
    if (response.tag === "conflict") {
      const actual = unwrapOptional(response.payload);
      throw new RevisionConflictError(
        request.expectedRevision,
        actual === null ? null : String(asSafeInteger(actual, "conflict.currentRevision")),
      );
    }
    if (response.tag === "err") throw new ResourceIntegrityError(String(response.payload ?? "stable-memory revision commit failed"));
    throw new ResourceIntegrityError(`Unknown sharing_commit_revision response: ${response.tag}`);
  }
}

export function createNeutronStableMemoryStore(): StableMemorySharedResourceStore {
  return new StableMemorySharedResourceStore(new NeutronStableMemorySharingTransport());
}
