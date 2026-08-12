import type {
  ExternalElement,
  FsEvent,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  JsonValue,
  NativeAppDefinition,
  NodeId,
  WriteOptions,
  CreateFileOptions,
} from "../contracts/index.ts";
import {
  NEUTRON_APP_METADATA_KEY,
  NEUTRON_APP_MIME,
  OWNERSHIP_METADATA_KEY,
  SYSTEM_APP_METADATA_KEY,
  SYSTEM_APP_MIME,
  classifyResource,
  neutronAppMetadata,
  readNeutronAppMetadata,
  readSystemAppMetadata,
  resourceCapabilities,
  systemAppMetadata,
  type ResourceOwnership,
} from "./resourcePolicy.ts";
import { reconcileProgramFilesRoot } from "./programFiles.ts";
import { shortcutMetadata, type SharedShortcutTarget, uniqueChildName } from "./shortcut.ts";

export const FILESYSTEM_BOOTSTRAP_METADATA_KEY = "plasmon.filesystem.bootstrap.v1";
export const DURABLE_SEED_LEDGER_KEY = "plasmon.filesystem.seeds.durable.v1";
export const DEMO_SEED_LEDGER_KEY = "plasmon.filesystem.seeds.demo.v1";
export const TRASH_METADATA_KEY = "plasmon.trash";
export const TRASH_PATH = "/System/.Trash";
export const START_MENU_PATH = "/System/Start Menu";
export const APPS_PATH = "/Apps";

export function isDotHiddenName(name: string): boolean {
  return name.startsWith(".") && name !== "." && name !== "..";
}

function eventSource(value: FsService): FsEventSource | null {
  const candidate = value as FsService & Partial<FsEventSource>;
  return typeof candidate.subscribe === "function" ? candidate as FsService & FsEventSource : null;
}

/**
 * Public filesystem facade used by Plasmon surfaces. The underlying storage
 * contract remains unchanged; this layer owns dot-hidden presentation semantics
 * and can gate consumers until product bootstrap/migration completes.
 */
export class ManagedFsService implements FsService, FsEventSource {
  private initialization: Promise<void> = Promise.resolve();

  constructor(readonly delegate: FsService) {}

  setInitialization(initialization: Promise<unknown>): void {
    this.initialization = initialization.then(() => undefined);
  }

  subscribe(listener: (event: FsEvent) => void): () => void {
    return eventSource(this.delegate)?.subscribe(listener) ?? (() => undefined);
  }

  private async ready(): Promise<void> {
    await this.initialization;
  }

  async stat(id: NodeId): Promise<FsNode> { await this.ready(); return this.delegate.stat(id); }
  async resolvePath(path: string): Promise<FsNode | null> { await this.ready(); return this.delegate.resolvePath(path); }
  async pathOf(id: NodeId): Promise<string> { await this.ready(); return this.delegate.pathOf(id); }

  async list(parentId: NodeId, options: FsListOptions = {}): Promise<FsNode[]> {
    await this.ready();
    const nodes = await this.delegate.list(parentId, { ...options, includeHidden: true });
    return options.includeHidden ? nodes : nodes.filter((node) => !isDotHiddenName(node.name));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> { await this.ready(); return this.delegate.mkdir(parentId, name); }
  async createFile(parentId: NodeId, name: string, options?: CreateFileOptions): Promise<FsNode> { await this.ready(); return this.delegate.createFile(parentId, name, options); }
  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> { await this.ready(); return this.delegate.read(id, range); }
  async write(id: NodeId, bytes: Uint8Array, options?: WriteOptions): Promise<FsNode> { await this.ready(); return this.delegate.write(id, bytes, options); }
  async rename(id: NodeId, newName: string): Promise<FsNode> { await this.ready(); return this.delegate.rename(id, newName); }
  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> { await this.ready(); return this.delegate.move(id, newParentId); }
  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> { await this.ready(); return this.delegate.copy(id, newParentId, name); }
  async remove(id: NodeId, options?: { recursive?: boolean }): Promise<void> { await this.ready(); return this.delegate.remove(id, options); }
  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> { await this.ready(); return this.delegate.setMetadata(id, patch); }
  async revision() { await this.ready(); return this.delegate.revision(); }
}

function jsonStringSet(value: JsonValue | undefined): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0));
}

async function ensureDirectory(
  fs: FsService,
  parent: FsNode,
  name: string,
  ownership: ResourceOwnership = "system-required",
): Promise<FsNode> {
  const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
  const existing = children.find((node) => node.name === name);
  if (existing) {
    if (existing.kind !== "directory") throw new Error(`${await fs.pathOf(parent.id)}/${name} is not a directory`);
    if (existing.metadata[OWNERSHIP_METADATA_KEY] !== ownership) {
      return fs.setMetadata(existing.id, { [OWNERSHIP_METADATA_KEY]: ownership });
    }
    return existing;
  }
  const created = await fs.mkdir(parent.id, name);
  return fs.setMetadata(created.id, { [OWNERSHIP_METADATA_KEY]: ownership });
}

async function ensureRootDirectory(fs: FsService, name: string, ownership: ResourceOwnership): Promise<FsNode> {
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  return ensureDirectory(fs, root, name, ownership);
}

async function findUniqueHiddenMigrationName(fs: FsService, node: FsNode): Promise<string> {
  if (!node.parentId) throw new Error("Filesystem root cannot be hidden");
  const preferred = `.${node.name}`;
  const siblings = await fs.list(node.parentId, { includeHidden: true, sort: "name" });
  const used = new Set(siblings.filter((entry) => entry.id !== node.id).map((entry) => entry.name.toLocaleLowerCase()));
  if (!used.has(preferred.toLocaleLowerCase())) return preferred;
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `.${node.name} (${index})`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error(`Could not migrate hidden name for ${node.name}`);
}

/** Converts the legacy metadata-hidden model to the approved dot-name model. */
export async function migrateLegacyHiddenMetadata(fs: FsService): Promise<{ renamed: number; cleared: number }> {
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  const queue = [root];
  const visited = new Set<NodeId>();
  let renamed = 0;
  let cleared = 0;
  while (queue.length > 0) {
    const directory = queue.shift();
    if (!directory || visited.has(directory.id)) continue;
    visited.add(directory.id);
    const children = await fs.list(directory.id, { includeHidden: true, sort: "name" });
    for (let child of children) {
      if (child.metadata.hidden === true) {
        const path = await fs.pathOf(child.id);
        const preserveVisibleSystemRoot = path === "/System";
        if (!preserveVisibleSystemRoot && !isDotHiddenName(child.name)) {
          child = await fs.rename(child.id, await findUniqueHiddenMigrationName(fs, child));
          renamed += 1;
        }
        await fs.setMetadata(child.id, { hidden: null });
        cleared += 1;
      }
      if (child.kind === "directory") queue.push(child);
    }
  }
  return { renamed, cleared };
}

async function mergeStartSeedHistory(fs: FsService, from: FsNode, to: FsNode): Promise<void> {
  const key = "plasmon.shell.start.seeded.v1";
  const merged = new Set([
    ...jsonStringSet(from.metadata[key]),
    ...jsonStringSet(to.metadata[key]),
  ]);
  if (merged.size > 0) await fs.setMetadata(to.id, { [key]: [...merged].sort() });
}

async function moveLegacyStartMenu(fs: FsService, system: FsNode): Promise<FsNode> {
  const legacy = await fs.resolvePath("/Start Menu");
  const current = await fs.resolvePath(START_MENU_PATH);
  if (!legacy) {
    return current ?? ensureDirectory(fs, system, "Start Menu", "system-required");
  }
  if (legacy.kind !== "directory") throw new Error("/Start Menu exists but is not a directory");
  if (!current) {
    const moved = await fs.move(legacy.id, system.id);
    await fs.setMetadata(moved.id, { [OWNERSHIP_METADATA_KEY]: "system-required" });
    return moved;
  }
  if (current.kind !== "directory") throw new Error(`${START_MENU_PATH} exists but is not a directory`);
  await mergeStartSeedHistory(fs, legacy, current);
  const children = await fs.list(legacy.id, { includeHidden: true, sort: "name" });
  for (const child of children) {
    const desired = await uniqueChildName(fs, current.id, child.name);
    if (desired !== child.name) await fs.rename(child.id, desired);
    await fs.move(child.id, current.id);
  }
  await fs.remove(legacy.id);
  return fs.setMetadata(current.id, { [OWNERSHIP_METADATA_KEY]: "system-required" });
}

const SYSTEM_APP_FILE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "native:explorer": "FileManager.sys",
  "native:settings": "Settings.sys",
  "native:photos": "Photos.sys",
  "native:browser": "Browser.sys",
  "native:properties": ".Properties.sys",
  "native:text": "TextEditor.sys",
  "native:markdown": "Markdown.sys",
  "native:video": "Video.sys",
  "native:start": "Start.sys",
  "native:search": "Search.sys",
  "native:recycle-bin": "RecycleBin.sys",
});

export function systemAppFileName(app: NativeAppDefinition): string | null {
  return SYSTEM_APP_FILE_NAMES[app.handlerId] ?? null;
}

async function reconcileSystemApps(fs: FsService, system: FsNode, apps: readonly NativeAppDefinition[]): Promise<number> {
  const children = await fs.list(system.id, { includeHidden: true, sort: "name" });
  const bySystemId = new Map<string, FsNode>();
  for (const child of children) {
    const metadata = readSystemAppMetadata(child);
    if (metadata) bySystemId.set(metadata.systemId, child);
  }
  let changed = 0;
  for (const app of apps) {
    const fileName = systemAppFileName(app);
    if (!fileName) continue;
    let node = bySystemId.get(app.id) ?? null;
    if (!node) {
      const occupied = children.find((child) => child.name.toLocaleLowerCase() === fileName.toLocaleLowerCase());
      if (occupied) {
        const occupiedMetadata = readSystemAppMetadata(occupied);
        if (!occupiedMetadata || occupiedMetadata.systemId !== app.id) {
          throw new Error(`System application path is occupied: /System/${fileName}`);
        }
        node = occupied;
      } else {
        node = await fs.createFile(system.id, fileName, {
          mime: SYSTEM_APP_MIME,
          metadata: systemAppMetadata(app.id, app.handlerId),
        });
        changed += 1;
      }
    }
    const patch: Record<string, JsonValue | null> = {
      [OWNERSHIP_METADATA_KEY]: "system-required",
      [SYSTEM_APP_METADATA_KEY]: systemAppMetadata(app.id, app.handlerId)[SYSTEM_APP_METADATA_KEY] ?? null,
    };
    if (node.mime !== SYSTEM_APP_MIME || node.name !== fileName || node.metadata[OWNERSHIP_METADATA_KEY] !== "system-required") {
      if (node.name !== fileName) await fs.rename(node.id, fileName);
      await fs.setMetadata(node.id, patch);
      changed += 1;
    }
  }
  return changed;
}

export interface FilesystemSeedSpec {
  key: string;
  seedClass: "durable" | "demo-temporary";
  parentPath: string;
  name: string;
  kind: "directory" | "file" | "shortcut";
  mime?: string;
  bytes?: Uint8Array;
  shortcutTarget?: SharedShortcutTarget;
  requireTargetPath?: string;
}

async function createSeed(fs: FsService, spec: FilesystemSeedSpec): Promise<FsNode | null> {
  if (spec.requireTargetPath && !(await fs.resolvePath(spec.requireTargetPath))) return null;
  const parent = await fs.resolvePath(spec.parentPath);
  if (!parent || parent.kind !== "directory") throw new Error(`Seed parent is unavailable: ${spec.parentPath}`);
  const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
  const existing = children.find((node) => node.name === spec.name);
  if (existing) return existing;
  const ownership: ResourceOwnership = spec.seedClass === "durable" ? "seeded-default" : "demo-temporary";
  if (spec.kind === "directory") {
    const node = await fs.mkdir(parent.id, spec.name);
    return fs.setMetadata(node.id, { [OWNERSHIP_METADATA_KEY]: ownership });
  }
  if (spec.kind === "shortcut") {
    if (!spec.shortcutTarget) throw new Error(`Shortcut seed ${spec.key} has no target`);
    return fs.createFile(parent.id, spec.name, {
      kind: "shortcut",
      metadata: shortcutMetadata(spec.shortcutTarget, ownership),
    });
  }
  const node = await fs.createFile(parent.id, spec.name, {
    ...(spec.mime ? { mime: spec.mime } : {}),
    metadata: { [OWNERSHIP_METADATA_KEY]: ownership },
  });
  if (spec.bytes) return fs.write(node.id, spec.bytes, { truncate: true });
  return node;
}

export async function reconcileSeedManifest(
  fs: FsService,
  specs: readonly FilesystemSeedSpec[],
): Promise<{ created: number; skippedDeleted: number; unavailable: number }> {
  const root = await fs.resolvePath("/");
  if (!root) throw new Error("Filesystem root is unavailable");
  const durable = jsonStringSet(root.metadata[DURABLE_SEED_LEDGER_KEY]);
  const demo = jsonStringSet(root.metadata[DEMO_SEED_LEDGER_KEY]);
  let created = 0;
  let skippedDeleted = 0;
  let unavailable = 0;
  let changedLedger = false;
  for (const spec of specs) {
    const ledger = spec.seedClass === "durable" ? durable : demo;
    if (ledger.has(spec.key)) {
      skippedDeleted += 1;
      continue;
    }
    const result = await createSeed(fs, spec);
    if (!result) {
      unavailable += 1;
      continue;
    }
    ledger.add(spec.key);
    changedLedger = true;
    created += 1;
  }
  if (changedLedger) {
    await fs.setMetadata(root.id, {
      [DURABLE_SEED_LEDGER_KEY]: [...durable].sort(),
      [DEMO_SEED_LEDGER_KEY]: [...demo].sort(),
    });
  }
  return { created, skippedDeleted, unavailable };
}

const DEFAULT_DURABLE_SEEDS: readonly FilesystemSeedSpec[] = [
  { key: "directory.games", seedClass: "durable", parentPath: "/", name: "Games", kind: "directory" },
  { key: "directory.music", seedClass: "durable", parentPath: "/", name: "Music", kind: "directory" },
];

const LEGACY_ALREADY_INTRODUCED_DURABLE_KEYS = [
  "directory.documents",
  "directory.pictures",
  "directory.videos",
] as const;

export interface BootstrapFilesystemOptions {
  nativeApps?: readonly NativeAppDefinition[];
  durableSeeds?: readonly FilesystemSeedSpec[];
  demoSeeds?: readonly FilesystemSeedSpec[];
}

export interface BootstrapFilesystemResult {
  hiddenRenamed: number;
  hiddenCleared: number;
  systemAppsChanged: number;
  durableSeedsCreated: number;
  demoSeedsCreated: number;
}

/** Versioned/idempotent product bootstrap using only FsService primitives. */
export async function bootstrapFilesystem(
  fs: FsService,
  options: BootstrapFilesystemOptions = {},
): Promise<BootstrapFilesystemResult> {
  const hidden = await migrateLegacyHiddenMetadata(fs);
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  const system = await ensureRootDirectory(fs, "System", "system-required");
  await ensureRootDirectory(fs, "Desktop", "system-required");
  await ensureRootDirectory(fs, "Apps", "system-required");
  await moveLegacyStartMenu(fs, system);
  await reconcileProgramFilesRoot(fs);
  await ensureDirectory(fs, system, ".Trash", "system-required");

  const refreshedRoot = await fs.stat(root.id);
  const bootstrap = refreshedRoot.metadata[FILESYSTEM_BOOTSTRAP_METADATA_KEY];
  if (bootstrap !== 1) {
    const durable = jsonStringSet(refreshedRoot.metadata[DURABLE_SEED_LEDGER_KEY]);
    for (const key of LEGACY_ALREADY_INTRODUCED_DURABLE_KEYS) durable.add(key);
    await fs.setMetadata(refreshedRoot.id, {
      [FILESYSTEM_BOOTSTRAP_METADATA_KEY]: 1,
      [DURABLE_SEED_LEDGER_KEY]: [...durable].sort(),
    });
  }

  const systemAppsChanged = await reconcileSystemApps(fs, system, options.nativeApps ?? []);
  const durable = await reconcileSeedManifest(fs, [...DEFAULT_DURABLE_SEEDS, ...(options.durableSeeds ?? [])]);
  const demo = await reconcileSeedManifest(fs, options.demoSeeds ?? []);
  return {
    hiddenRenamed: hidden.renamed,
    hiddenCleared: hidden.cleared,
    systemAppsChanged,
    durableSeedsCreated: durable.created,
    demoSeedsCreated: demo.created,
  };
}

function sanitizeProjectionName(name: string): string {
  const safe = name.replace(/[\\/\0]/gu, " ").replace(/\s+/gu, " ").trim() || "Application";
  return `${safe}.neutron`;
}

export class NeutronProjectionService {
  constructor(private readonly fs: FsService) {}

  async reconcile(elements: readonly ExternalElement[]): Promise<{ created: number; updated: number; removed: number }> {
    const apps = await this.fs.resolvePath(APPS_PATH) ?? await ensureRootDirectory(this.fs, "Apps", "system-required");
    if (apps.kind !== "directory") throw new Error(`${APPS_PATH} is not a directory`);
    const children = await this.fs.list(apps.id, { includeHidden: true, sort: "name" });
    const projections = children.filter((node) => readNeutronAppMetadata(node));
    const byElement = new Map<string, FsNode>();
    for (const node of projections) {
      const metadata = readNeutronAppMetadata(node);
      if (metadata && !byElement.has(metadata.elementId)) byElement.set(metadata.elementId, node);
    }
    const installed = new Set(elements.map((element) => element.id));
    let created = 0;
    let updated = 0;
    let removed = 0;

    for (const element of elements) {
      let node = byElement.get(element.id) ?? null;
      const metadata = neutronAppMetadata({
        elementId: element.id,
        name: element.name,
        description: element.description,
        ...(element.version === undefined ? {} : { appVersion: element.version }),
        ...(element.icon ? { icon: element.icon } : {}),
      });
      if (!node) {
        const preferred = sanitizeProjectionName(element.name);
        const name = await uniqueChildName(this.fs, apps.id, preferred);
        node = await this.fs.createFile(apps.id, name, {
          mime: NEUTRON_APP_MIME,
          metadata,
        });
        byElement.set(element.id, node);
        created += 1;
        continue;
      }
      const preferred = sanitizeProjectionName(element.name);
      if (node.name !== preferred) {
        const otherNames = new Set((await this.fs.list(apps.id, { includeHidden: true })).filter((entry) => entry.id !== node!.id).map((entry) => entry.name.toLocaleLowerCase()));
        if (!otherNames.has(preferred.toLocaleLowerCase())) node = await this.fs.rename(node.id, preferred);
      }
      await this.fs.setMetadata(node.id, {
        [OWNERSHIP_METADATA_KEY]: "installed-app-projection",
        [NEUTRON_APP_METADATA_KEY]: metadata[NEUTRON_APP_METADATA_KEY] ?? null,
      });
      updated += 1;
    }

    for (const node of projections) {
      const metadata = readNeutronAppMetadata(node);
      if (!metadata || installed.has(metadata.elementId)) continue;
      await this.fs.remove(node.id);
      removed += 1;
    }
    return { created, updated, removed };
  }
}

function trashRecord(node: FsNode, originalPath: string): JsonValue {
  return {
    format: "plasmon.trash",
    version: 1,
    trashedNodeId: node.id,
    originalParentId: node.parentId,
    originalName: node.name,
    originalPath,
    deletedAt: Date.now(),
  };
}

export interface TrashEntry {
  wrapper: FsNode;
  node: FsNode;
  originalParentId: NodeId | null;
  originalName: string;
  originalPath: string;
  deletedAt: number;
}

function parseTrashEntry(wrapper: FsNode, node: FsNode): TrashEntry | null {
  const value = wrapper.metadata[TRASH_METADATA_KEY];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, JsonValue>;
  if (record.format !== "plasmon.trash" || record.version !== 1 || record.trashedNodeId !== node.id) return null;
  if (typeof record.originalName !== "string" || typeof record.originalPath !== "string" || typeof record.deletedAt !== "number") return null;
  const originalParentId = typeof record.originalParentId === "string" ? record.originalParentId : null;
  return { wrapper, node, originalParentId, originalName: record.originalName, originalPath: record.originalPath, deletedAt: record.deletedAt };
}

async function uniqueTrashWrapperName(fs: FsService, trashId: NodeId, nodeId: NodeId): Promise<string> {
  const base = `.item-${nodeId.replace(/[^a-zA-Z0-9_-]/gu, "-")}`;
  return uniqueChildName(fs, trashId, base);
}

async function ensureTrash(fs: FsService): Promise<FsNode> {
  const existing = await fs.resolvePath(TRASH_PATH);
  if (existing) {
    if (existing.kind !== "directory") throw new Error(`${TRASH_PATH} is not a directory`);
    return existing;
  }
  const system = await ensureRootDirectory(fs, "System", "system-required");
  return ensureDirectory(fs, system, ".Trash", "system-required");
}

async function nodeInsideTrash(fs: FsService, id: NodeId): Promise<boolean> {
  const trash = await fs.resolvePath(TRASH_PATH);
  if (!trash) return false;
  let cursor: NodeId | null = id;
  const visited = new Set<NodeId>();
  while (cursor) {
    if (cursor === trash.id) return true;
    if (visited.has(cursor)) throw new Error("Filesystem parent cycle detected");
    visited.add(cursor);
    const node = await fs.stat(cursor);
    cursor = node.parentId;
  }
  return false;
}

export class TrashService {
  constructor(private readonly fs: FsService) {}

  async trash(nodeId: NodeId): Promise<TrashEntry> {
    const node = await this.fs.stat(nodeId);
    const capabilities = resourceCapabilities(node);
    if (!capabilities.delete) {
      const classification = classifyResource(node);
      if (classification.kind === "neutron-app") throw new Error(`${node.name} is an installed application; use Uninstall instead`);
      throw new Error(`${node.name || "This resource"} is protected and cannot be deleted`);
    }
    if (await nodeInsideTrash(this.fs, node.id)) throw new Error(`${node.name} is already in Recycle Bin`);
    if (!node.parentId) throw new Error("Filesystem root cannot be deleted");
    const trash = await ensureTrash(this.fs);
    const originalPath = await this.fs.pathOf(node.id);
    const wrapperName = await uniqueTrashWrapperName(this.fs, trash.id, node.id);
    let wrapper = await this.fs.mkdir(trash.id, wrapperName);
    wrapper = await this.fs.setMetadata(wrapper.id, {
      [OWNERSHIP_METADATA_KEY]: "system-required",
      [TRASH_METADATA_KEY]: trashRecord(node, originalPath),
    });
    try {
      const moved = await this.fs.move(node.id, wrapper.id);
      const parsed = parseTrashEntry(wrapper, moved);
      if (!parsed) throw new Error("Recycle Bin metadata is invalid");
      return parsed;
    } catch (error) {
      try { await this.fs.remove(wrapper.id, { recursive: true }); } catch { /* preserve original failure */ }
      throw error;
    }
  }

  async list(): Promise<TrashEntry[]> {
    const trash = await ensureTrash(this.fs);
    const wrappers = await this.fs.list(trash.id, { includeHidden: true, sort: "modified" });
    const result: TrashEntry[] = [];
    for (const wrapper of wrappers) {
      if (wrapper.kind !== "directory") continue;
      const children = await this.fs.list(wrapper.id, { includeHidden: true, sort: "name" });
      const node = children[0];
      if (!node) continue;
      const parsed = parseTrashEntry(wrapper, node);
      if (parsed) result.push(parsed);
    }
    return result.sort((left, right) => right.deletedAt - left.deletedAt);
  }

  async restore(trashedNodeId: NodeId, fallbackPath = "/Desktop"): Promise<{ node: FsNode; usedFallback: boolean; renamed: boolean }> {
    const entries = await this.list();
    const entry = entries.find((candidate) => candidate.node.id === trashedNodeId);
    if (!entry) throw new Error("Recycle Bin item was not found");
    let destination: FsNode | null = null;
    let usedFallback = false;
    if (entry.originalParentId) {
      try {
        const parent = await this.fs.stat(entry.originalParentId);
        if (parent.kind === "directory" && !await nodeInsideTrash(this.fs, parent.id)) destination = parent;
      } catch { /* original parent no longer exists */ }
    }
    if (!destination) {
      destination = await this.fs.resolvePath(fallbackPath);
      if (!destination || destination.kind !== "directory") throw new Error("Original location is unavailable and no restore fallback exists");
      usedFallback = true;
    }
    const siblings = await this.fs.list(destination.id, { includeHidden: true, sort: "name" });
    let name = entry.originalName;
    let renamed = false;
    if (siblings.some((node) => node.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      name = await uniqueChildName(this.fs, destination.id, entry.originalName);
      renamed = true;
    }
    let current = entry.node;
    if (current.name !== name) current = await this.fs.rename(current.id, name);
    try {
      current = await this.fs.move(current.id, destination.id);
    } catch (error) {
      if (current.name !== entry.originalName) {
        try { await this.fs.rename(current.id, entry.originalName); } catch { /* preserve move failure */ }
      }
      throw error;
    }
    await this.fs.remove(entry.wrapper.id);
    return { node: current, usedFallback, renamed };
  }

  async permanentlyDelete(trashedNodeId: NodeId): Promise<void> {
    const entries = await this.list();
    const entry = entries.find((candidate) => candidate.node.id === trashedNodeId);
    if (!entry) throw new Error("Recycle Bin item was not found");
    const classification = classifyResource(entry.node);
    if (classification.kind === "system-app" || classification.kind === "neutron-app") {
      throw new Error(`${entry.node.name} is protected and cannot be permanently deleted`);
    }
    await this.fs.remove(entry.node.id, entry.node.kind === "directory" ? { recursive: true } : undefined);
    await this.fs.remove(entry.wrapper.id);
  }

  async empty(): Promise<number> {
    const entries = await this.list();
    let removed = 0;
    for (const entry of entries) {
      const classification = classifyResource(entry.node);
      if (classification.kind === "system-app" || classification.kind === "neutron-app") continue;
      await this.fs.remove(entry.node.id, entry.node.kind === "directory" ? { recursive: true } : undefined);
      await this.fs.remove(entry.wrapper.id);
      removed += 1;
    }
    return removed;
  }
}
