import type { FsNodeKind } from "../contracts/fs.ts";

export const SHARING_PROVIDER_SCHEMA_VERSION = 1 as const;
export const SHARING_PROVIDER_ID = "plasmon.shared-resource-provider";
export const PLASMON_ATOM_NAMESPACE = "plasmon.atom";
export const PLASMON_FILE_NAMESPACE = "plasmon.file";
export const DEFAULT_STABLE_CHUNK_SIZE = 1024 * 1024;
export const MAX_STABLE_CHUNK_SIZE = 1024 * 1024;

export interface ProviderResourceIdentity {
  namespace: string;
  resourceId: string;
}

export interface ProviderAtomSnapshot {
  format: "plasmon.atom";
  version: 1;
  atomId: string;
  handlerId: string;
  atomType: string;
  schemaVersion: number;
  title?: string;
}

export interface ProviderSnapshotMetadata {
  displayName: string;
  kind: Exclude<FsNodeKind, "directory">;
  mime?: string;
  atom?: ProviderAtomSnapshot;
}

export interface ProviderChunkRef {
  /** Lower-case SHA-256 hex. */
  hash: string;
  size: number;
}

export interface ProviderRevisionRecord {
  schemaVersion: typeof SHARING_PROVIDER_SCHEMA_VERSION;
  identity: ProviderResourceIdentity;
  resourceType: string;
  revision: string;
  byteLength: number;
  contentRootHash: string;
  chunks: readonly ProviderChunkRef[];
  snapshot: ProviderSnapshotMetadata;
  createdAt: number;
}

export interface ProviderResourceRecord {
  schemaVersion: typeof SHARING_PROVIDER_SCHEMA_VERSION;
  identity: ProviderResourceIdentity;
  resourceType: string;
  currentRevision: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderCommitRequest {
  identity: ProviderResourceIdentity;
  resourceType: string;
  expectedRevision: string | null;
  byteLength: number;
  contentRootHash: string;
  chunks: readonly ProviderChunkRef[];
  snapshot: ProviderSnapshotMetadata;
  createdAt: number;
}

export class SharingProviderError extends Error {}

export class InvalidPublishedResourceError extends SharingProviderError {}

export class UnsupportedPublishedResourceError extends SharingProviderError {}

export class ProviderSchemaVersionError extends SharingProviderError {
  constructor(readonly actualVersion: number) {
    super(`Unsupported shared-resource provider schema version: ${actualVersion}`);
    this.name = "ProviderSchemaVersionError";
  }
}

export class ChunkIntegrityError extends SharingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "ChunkIntegrityError";
  }
}

export class ResourceIntegrityError extends SharingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "ResourceIntegrityError";
  }
}

export class RevisionConflictError extends SharingProviderError {
  constructor(
    readonly expectedRevision: string | null,
    readonly actualRevision: string | null,
  ) {
    super(`Shared-resource revision conflict: expected ${expectedRevision ?? "none"}, current ${actualRevision ?? "none"}`);
    this.name = "RevisionConflictError";
  }
}
