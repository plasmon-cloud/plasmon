import type {
  FsEvent,
  FsEventSource,
  FsNode,
  FsService,
  JsonValue,
} from "../contracts/index.ts";
import {
  CONFIGURATION_FILE_METADATA_KEY,
  OWNERSHIP_METADATA_KEY,
} from "./resourcePolicy.ts";

export const CONFIGURATION_PATH = "/System/Configuration";
export const CONFIGURATION_ROOT_METADATA_KEY = "plasmon.configurationRoot";
export const CONFIGURATION_OWNER_METADATA_KEY = "plasmon.configurationOwner";
export const CONFIGURATION_RECONCILIATION_VERSION = 1;

export interface ConfigurationRootMetadata {
  format: "plasmon.configuration-root";
  version: typeof CONFIGURATION_RECONCILIATION_VERSION;
}

export interface ConfigurationOwnerMetadata {
  format: "plasmon.configuration-owner";
  version: typeof CONFIGURATION_RECONCILIATION_VERSION;
  owner: string;
}

export interface ConfigurationFileMetadata {
  format: "plasmon.configuration-file";
  version: typeof CONFIGURATION_RECONCILIATION_VERSION;
  owner: string;
  schema: string;
  schemaVersion: number;
}

export type ConfigurationReloadClass =
  | "live"
  | "owner-reopen"
  | "shell-restart"
  | "plasmon-restart";

export interface ConfigurationFileDeclaration {
  readonly owner: string;
  readonly fileName: string;
  readonly schema: string;
  readonly version: number;
  readonly reloadClass: ConfigurationReloadClass;
  readonly initialText: string;
  readonly mime?: string;
}

export interface ConfigurationService {
  root(): Promise<FsNode>;
  ensureOwnerDirectory(owner: string): Promise<FsNode>;
  ensureFile(declaration: ConfigurationFileDeclaration): Promise<FsNode>;
  subscribe(declaration: ConfigurationFileDeclaration, listener: () => void): () => void;
}

export type ConfigurationDocument = Record<string, JsonValue>;

export interface ConfigurationDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface ConfigurationParseResult<T> {
  readonly accepted: boolean;
  readonly value: T;
  readonly document: ConfigurationDocument | null;
  readonly diagnostics: readonly ConfigurationDiagnostic[];
}

export interface ConfigurationMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(document: ConfigurationDocument): ConfigurationDocument;
}

export interface ConfigurationDocumentDefinition<T> {
  readonly declaration: ConfigurationFileDeclaration;
  readonly defaults: T;
  readonly defaultDocument: ConfigurationDocument;
  readonly migrations?: readonly ConfigurationMigration[];
  parse(document: ConfigurationDocument): {
    value: T;
    diagnostics?: readonly ConfigurationDiagnostic[];
  };
  equals?(left: T, right: T): boolean;
}

export interface ConfigurationDocumentStoreOptions<T> {
  fs: FsService;
  configuration: ConfigurationService;
  definition: ConfigurationDocumentDefinition<T>;
  onDiagnostic?: (diagnostic: ConfigurationDiagnostic) => void;
}

export interface ConfigurationDocumentStore<T> {
  readonly ready: Promise<void>;
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  update(mutator: (document: ConfigurationDocument) => ConfigurationDocument): Promise<void>;
  restoreDefaults(): Promise<void>;
  dispose(): void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function cloneDocument(document: ConfigurationDocument): ConfigurationDocument {
  return structuredClone(document);
}

function object(value: unknown): ConfigurationDocument | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ConfigurationDocument
    : null;
}

function diagnostic(code: string, message: string): ConfigurationDiagnostic {
  return Object.freeze({ code, message });
}

function validName(value: string, label: string): string {
  if (!value || value.trim() !== value || value === "." || value === ".." || /[\\/\0]/u.test(value)) {
    throw new Error(`Invalid configuration ${label}: ${value || "<empty>"}`);
  }
  return value;
}

function declarationKey(declaration: ConfigurationFileDeclaration): string {
  return `${declaration.owner}\0${declaration.fileName}`.toLocaleLowerCase();
}

function rootMetadata(): JsonValue {
  return {
    format: "plasmon.configuration-root",
    version: CONFIGURATION_RECONCILIATION_VERSION,
  } satisfies ConfigurationRootMetadata;
}

function ownerMetadata(owner: string): JsonValue {
  return {
    format: "plasmon.configuration-owner",
    version: CONFIGURATION_RECONCILIATION_VERSION,
    owner,
  } satisfies ConfigurationOwnerMetadata;
}

function fileMetadata(declaration: ConfigurationFileDeclaration): JsonValue {
  return {
    format: "plasmon.configuration-file",
    version: CONFIGURATION_RECONCILIATION_VERSION,
    owner: declaration.owner,
    schema: declaration.schema,
    schemaVersion: declaration.version,
  } satisfies ConfigurationFileMetadata;
}

function hasMetadata(
  value: JsonValue | undefined,
  format: string,
): value is { [key: string]: JsonValue } {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && value.format === format
    && value.version === CONFIGURATION_RECONCILIATION_VERSION;
}

function readFileMetadata(node: FsNode): ConfigurationFileMetadata | null {
  const value = node.metadata[CONFIGURATION_FILE_METADATA_KEY];
  if (!hasMetadata(value, "plasmon.configuration-file")) return null;
  if (typeof value.owner !== "string" || typeof value.schema !== "string") return null;
  if (typeof value.schemaVersion !== "number" || !Number.isSafeInteger(value.schemaVersion)) return null;
  return {
    format: "plasmon.configuration-file",
    version: CONFIGURATION_RECONCILIATION_VERSION,
    owner: value.owner,
    schema: value.schema,
    schemaVersion: value.schemaVersion,
  };
}

async function ensureSystemDirectory(fs: FsService): Promise<FsNode> {
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  let system = await fs.resolvePath("/System");
  if (!system) system = await fs.mkdir(root.id, "System");
  if (system.kind !== "directory") throw new Error("/System exists but is not a directory");
  if (system.metadata[OWNERSHIP_METADATA_KEY] !== "system-required") {
    system = await fs.setMetadata(system.id, { [OWNERSHIP_METADATA_KEY]: "system-required" });
  }
  return system;
}

async function reconcileRoot(fs: FsService): Promise<FsNode> {
  const system = await ensureSystemDirectory(fs);
  let root = await fs.resolvePath(CONFIGURATION_PATH);
  if (!root) root = await fs.mkdir(system.id, "Configuration");
  if (root.kind !== "directory") throw new Error(`${CONFIGURATION_PATH} is not a directory`);
  const metadata = root.metadata[CONFIGURATION_ROOT_METADATA_KEY];
  if (
    root.metadata[OWNERSHIP_METADATA_KEY] !== "system-required"
    || !hasMetadata(metadata, "plasmon.configuration-root")
  ) {
    root = await fs.setMetadata(root.id, {
      [OWNERSHIP_METADATA_KEY]: "system-required",
      [CONFIGURATION_ROOT_METADATA_KEY]: rootMetadata(),
    });
  }
  return root;
}

async function reconcileOwner(fs: FsService, owner: string): Promise<FsNode> {
  const canonicalOwner = validName(owner, "owner name");
  const root = await reconcileRoot(fs);
  const children = await fs.list(root.id, { includeHidden: true, sort: "name" });
  let directory = children.find((node) => node.name.toLocaleLowerCase() === canonicalOwner.toLocaleLowerCase()) ?? null;
  if (!directory) directory = await fs.mkdir(root.id, canonicalOwner);
  if (directory.kind !== "directory") {
    throw new Error(`${CONFIGURATION_PATH}/${directory.name} is not a directory`);
  }
  const metadata = directory.metadata[CONFIGURATION_OWNER_METADATA_KEY];
  if (
    directory.metadata[OWNERSHIP_METADATA_KEY] !== "system-required"
    || !hasMetadata(metadata, "plasmon.configuration-owner")
    || metadata.owner !== canonicalOwner
  ) {
    directory = await fs.setMetadata(directory.id, {
      [OWNERSHIP_METADATA_KEY]: "system-required",
      [CONFIGURATION_OWNER_METADATA_KEY]: ownerMetadata(canonicalOwner),
    });
  }
  return directory;
}

export async function reconcileConfigurationRoot(fs: FsService): Promise<FsNode> {
  return reconcileRoot(fs);
}

export async function reconcileConfigurationOwner(fs: FsService, owner: string): Promise<FsNode> {
  return reconcileOwner(fs, owner);
}

export async function reconcileConfigurationFile(
  fs: FsService,
  declaration: ConfigurationFileDeclaration,
): Promise<FsNode> {
  const owner = validName(declaration.owner, "owner name");
  const fileName = validName(declaration.fileName, "file name");
  if (!declaration.schema || declaration.schema.trim() !== declaration.schema) {
    throw new Error("Invalid configuration schema identity");
  }
  if (!Number.isSafeInteger(declaration.version) || declaration.version < 1) {
    throw new Error("Invalid configuration schema version");
  }
  if (!["live", "owner-reopen", "shell-restart", "plasmon-restart"].includes(declaration.reloadClass)) {
    throw new Error("Invalid configuration reload class");
  }
  const directory = await reconcileOwner(fs, owner);
  const children = await fs.list(directory.id, { includeHidden: true, sort: "name" });
  const existing = children.find((node) => node.name.toLocaleLowerCase() === fileName.toLocaleLowerCase()) ?? null;
  if (existing) {
    if (existing.kind !== "file") {
      throw new Error(`${CONFIGURATION_PATH}/${owner}/${existing.name} is not a file`);
    }
    const existingMetadata = readFileMetadata(existing);
    if (
      existingMetadata
      && (
        existingMetadata.owner !== owner
        || existingMetadata.schema !== declaration.schema
        || existingMetadata.schemaVersion !== declaration.version
      )
    ) {
      throw new Error(`${CONFIGURATION_PATH}/${owner}/${existing.name} belongs to another configuration declaration`);
    }
    if (
      existing.metadata[OWNERSHIP_METADATA_KEY] !== "system-required"
      || !existingMetadata
    ) {
      return fs.setMetadata(existing.id, {
        [OWNERSHIP_METADATA_KEY]: "system-required",
        [CONFIGURATION_FILE_METADATA_KEY]: fileMetadata({ ...declaration, owner, fileName }),
      });
    }
    return existing;
  }

  let file = await fs.createFile(directory.id, fileName, {
    ...(declaration.mime ? { mime: declaration.mime } : {}),
    metadata: {
      [OWNERSHIP_METADATA_KEY]: "system-required",
      [CONFIGURATION_FILE_METADATA_KEY]: fileMetadata({ ...declaration, owner, fileName }),
    },
  });
  if (declaration.initialText.length > 0) {
    file = await fs.write(file.id, encoder.encode(declaration.initialText), { truncate: true });
  }
  return file;
}

export class ManagedConfigurationService implements ConfigurationService {
  private readonly entries = new Map<string, { ownerId: string; fileId: string }>();

  constructor(
    private readonly fs: FsService,
    private readonly events: FsEventSource,
    private readonly ready: Promise<unknown> = Promise.resolve(),
  ) {}

  async root(): Promise<FsNode> {
    await this.ready;
    return reconcileRoot(this.fs);
  }

  async ensureOwnerDirectory(owner: string): Promise<FsNode> {
    await this.ready;
    return reconcileOwner(this.fs, owner);
  }

  async ensureFile(declaration: ConfigurationFileDeclaration): Promise<FsNode> {
    await this.ready;
    const file = await reconcileConfigurationFile(this.fs, declaration);
    const owner = await this.fs.resolvePath(`${CONFIGURATION_PATH}/${declaration.owner}`);
    if (owner) this.entries.set(declarationKey(declaration), { ownerId: owner.id, fileId: file.id });
    return file;
  }

  subscribe(declaration: ConfigurationFileDeclaration, listener: () => void): () => void {
    const key = declarationKey(declaration);
    return this.events.subscribe((event) => {
      const entry = this.entries.get(key);
      if (event.type === "reset") {
        listener();
        return;
      }
      if (!entry) return;
      if (event.type === "removed") {
        if (event.id === entry.fileId || event.id === entry.ownerId || event.parentId === entry.ownerId) listener();
        return;
      }
      if (event.node.id === entry.fileId || event.node.parentId === entry.ownerId) listener();
      if (event.type === "moved" && event.oldParentId === entry.ownerId) listener();
    });
  }
}

function canonicalDocument<T>(definition: ConfigurationDocumentDefinition<T>): ConfigurationDocument {
  const document = cloneDocument(definition.defaultDocument);
  document.schema = definition.declaration.schema;
  document.version = definition.declaration.version;
  return document;
}

function serializeDocument(document: ConfigurationDocument): Uint8Array {
  return encoder.encode(`${JSON.stringify(document, null, 2)}\n`);
}

export function parseConfigurationDocument<T>(
  text: string,
  definition: ConfigurationDocumentDefinition<T>,
): ConfigurationParseResult<T> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      accepted: false,
      value: definition.defaults,
      document: null,
      diagnostics: [diagnostic("malformed-json", "Configuration document is not valid JSON")],
    };
  }
  const document = object(value);
  if (!document) {
    return {
      accepted: false,
      value: definition.defaults,
      document: null,
      diagnostics: [diagnostic("invalid-root", "Configuration document must be a JSON object")],
    };
  }
  if (document.schema !== definition.declaration.schema) {
    return {
      accepted: false,
      value: definition.defaults,
      document,
      diagnostics: [diagnostic("unsupported-schema", "Configuration document has an unsupported schema identity")],
    };
  }
  if (document.version !== definition.declaration.version) {
    return {
      accepted: false,
      value: definition.defaults,
      document,
      diagnostics: [diagnostic("unsupported-version", "Configuration document has an unsupported schema version")],
    };
  }
  try {
    const parsed = definition.parse(document);
    return {
      accepted: true,
      value: parsed.value,
      document,
      diagnostics: parsed.diagnostics ?? [],
    };
  } catch {
    return {
      accepted: false,
      value: definition.defaults,
      document,
      diagnostics: [diagnostic("validation-failed", "Configuration document validation failed")],
    };
  }
}

export function migrateConfigurationDocument<T>(
  document: ConfigurationDocument,
  definition: ConfigurationDocumentDefinition<T>,
): { document: ConfigurationDocument; migrated: boolean } | null {
  const version = document.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version)) return null;
  if (version === definition.declaration.version) return { document: cloneDocument(document), migrated: false };
  if (version > definition.declaration.version) return null;

  let current = cloneDocument(document);
  let currentVersion = version;
  const migrations = definition.migrations ?? [];
  const visited = new Set<number>();
  while (currentVersion < definition.declaration.version) {
    if (visited.has(currentVersion)) return null;
    visited.add(currentVersion);
    const migration = migrations.find((candidate) => candidate.fromVersion === currentVersion);
    if (!migration || migration.toVersion <= currentVersion || migration.toVersion > definition.declaration.version) return null;
    let migratedValue: unknown;
    try {
      migratedValue = migration.migrate(cloneDocument(current));
    } catch {
      return null;
    }
    const next = object(migratedValue);
    if (!next) return null;
    next.schema = definition.declaration.schema;
    next.version = migration.toVersion;
    current = next;
    currentVersion = migration.toVersion;
  }
  return currentVersion === definition.declaration.version ? { document: current, migrated: true } : null;
}

export class FilesystemConfigurationDocumentStore<T> implements ConfigurationDocumentStore<T> {
  private snapshot: T;
  private readonly listeners = new Set<() => void>();
  private readonly stopEvents: () => void;
  private reloadTail: Promise<void> = Promise.resolve();
  private disposed = false;
  private readonly reportedDiagnostics = new Set<string>();
  readonly ready: Promise<void>;

  constructor(private readonly options: ConfigurationDocumentStoreOptions<T>) {
    this.snapshot = options.definition.defaults;
    this.stopEvents = options.definition.declaration.reloadClass === "live"
      ? options.configuration.subscribe(options.definition.declaration, () => {
        if (!this.disposed) void this.scheduleReload(false);
      })
      : () => undefined;
    this.ready = this.initialize();
  }

  getSnapshot(): T {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async update(mutator: (document: ConfigurationDocument) => ConfigurationDocument): Promise<void> {
    await this.ready;
    const file = await this.options.configuration.ensureFile(this.options.definition.declaration);
    const parsed = await this.read(file.id, false);
    if (!parsed.accepted || !parsed.document) return;
    const next = object(mutator(cloneDocument(parsed.document)));
    if (!next) throw new Error("Configuration update must return a JSON object");
    await this.options.fs.write(file.id, serializeDocument(next), { truncate: true });
    await this.scheduleReload(false);
  }

  async restoreDefaults(): Promise<void> {
    await this.ready;
    const file = await this.options.configuration.ensureFile(this.options.definition.declaration);
    await this.options.fs.write(file.id, serializeDocument(canonicalDocument(this.options.definition)), { truncate: true });
    await this.scheduleReload(false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopEvents();
    this.listeners.clear();
  }

  private initialize(): Promise<void> {
    return this.options.configuration.ensureFile(this.options.definition.declaration)
      .then(() => this.scheduleReload(true));
  }

  private scheduleReload(coldStart: boolean): Promise<void> {
    const next = this.reloadTail.then(() => this.reload(coldStart));
    this.reloadTail = next.catch(() => undefined);
    return next;
  }

  private async read(id: string, coldStart: boolean): Promise<ConfigurationParseResult<T>> {
    const text = decoder.decode(await this.options.fs.read(id));
    let parsed = parseConfigurationDocument(text, this.options.definition);
    if (!parsed.accepted && parsed.document) {
      const migrated = migrateConfigurationDocument(parsed.document, this.options.definition);
      if (migrated?.migrated) {
        await this.options.fs.write(id, serializeDocument(migrated.document), { truncate: true });
        parsed = parseConfigurationDocument(JSON.stringify(migrated.document), this.options.definition);
      }
    }
    this.reportDiagnostics(parsed.diagnostics);
    if (!parsed.accepted) {
      this.publish(coldStart ? this.options.definition.defaults : this.snapshot);
    } else {
      if (parsed.diagnostics.length === 0) this.reportedDiagnostics.clear();
      this.publish(parsed.value);
    }
    return parsed;
  }

  private async reload(coldStart: boolean): Promise<void> {
    if (this.disposed) return;
    const file = await this.options.configuration.ensureFile(this.options.definition.declaration);
    await this.read(file.id, coldStart);
  }

  private reportDiagnostics(diagnostics: readonly ConfigurationDiagnostic[]): void {
    for (const item of diagnostics) {
      const key = `${item.code}:${item.message}`;
      if (this.reportedDiagnostics.has(key)) continue;
      this.reportedDiagnostics.add(key);
      this.options.onDiagnostic?.(item);
    }
  }

  private publish(next: T): void {
    const equals = this.options.definition.equals ?? Object.is;
    if (equals(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
