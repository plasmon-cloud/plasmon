export const SHARING_PROVIDER_SCHEMA_VERSION = 1 as const;
export const SHARING_PROVIDER_ID = "plasmon-sharing";
export const PLASMON_ATOM_NAMESPACE = "plasmon.atom";
export const PLASMON_FILE_NAMESPACE = "plasmon.file";
export const DEFAULT_STABLE_CHUNK_SIZE = 1024 * 1024;

export type ProviderResourceIdentity = {
  namespace: typeof PLASMON_ATOM_NAMESPACE | typeof PLASMON_FILE_NAMESPACE;
  resourceId: string;
};

export type ProviderChunkRef = {
  hash: string;
  size: number;
};

export type PublishedAtomMetadata = {
  format: "plasmon.atom";
  version: 1;
  atomId: string;
  handlerId: string;
  atomType: string;
  schemaVersion: number;
  title?: string;
};

export type ProviderSnapshotMetadata = {
  displayName: string;
  kind: "file" | "shortcut" | "atom";
  mime?: string;
  atom?: PublishedAtomMetadata;
};

export type ProviderResourceRecord = {
  schemaVersion: typeof SHARING_PROVIDER_SCHEMA_VERSION;
  identity: ProviderResourceIdentity;
  resourceType: string;
  currentRevision: string;
  createdAt: number;
  updatedAt: number;
};

export type ProviderRevisionRecord = {
  schemaVersion: typeof SHARING_PROVIDER_SCHEMA_VERSION;
  identity: ProviderResourceIdentity;
  resourceType: string;
  revision: string;
  byteLength: number;
  contentRootHash: string;
  chunks: ProviderChunkRef[];
  snapshot: ProviderSnapshotMetadata;
  createdAt: number;
};

export type ProviderCommitRequest = {
  identity: ProviderResourceIdentity;
  resourceType: string;
  expectedRevision: string | null;
  byteLength: number;
  contentRootHash: string;
  chunks: readonly ProviderChunkRef[];
  snapshot: ProviderSnapshotMetadata;
  createdAt: number;
};

export class SharingProviderError extends Error {}

export class InvalidPublishedResourceError extends SharingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPublishedResourceError";
  }
}

export class UnsupportedPublishedResourceError extends SharingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPublishedResourceError";
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
  readonly expectedRevision: string | null;
  readonly actualRevision: string | null;

  constructor(expectedRevision: string | null, actualRevision: string | null) {
    super(`Revision conflict: expected ${expectedRevision ?? "unpublished"}, actual ${actualRevision ?? "unpublished"}`);
    this.name = "RevisionConflictError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class ProviderSchemaVersionError extends SharingProviderError {
  readonly actualVersion: number;

  constructor(actualVersion: number) {
    super(`Unsupported sharing provider schema version ${actualVersion}; expected ${SHARING_PROVIDER_SCHEMA_VERSION}`);
    this.name = "ProviderSchemaVersionError";
    this.actualVersion = actualVersion;
  }
}
