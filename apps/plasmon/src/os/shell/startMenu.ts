import type {
  ExternalElement,
  FsNode,
  FsService,
  HandlerId,
  JsonValue,
  NativeAppDefinition,
} from "../contracts/index.ts";
import {
  parseSharedShortcut,
  shortcutMetadata as sharedShortcutMetadata,
  type SharedShortcutTarget,
} from "../fs/shortcut.ts";

export const START_MENU_PATH = "/System/Start Menu";
export const START_MENU_NAME = "Start Menu";
export const START_SHORTCUT_METADATA_KEY = "plasmon.shortcut";
export const START_SEEDED_IDENTITIES_KEY = "plasmon.shell.start.seeded.v1";
export const START_MANAGED_FOLDER_IDS_KEY = "plasmon.shell.start.managed-folders.v1";

const FORMER_SYSTEM_NATIVE_HANDLERS = new Set<HandlerId>([
  "native:settings",
  "native:explorer",
  "native:properties",
]);

const RETIRED_DEFAULT_START_NATIVE_HANDLERS = new Set<HandlerId>([
  "native:settings",
  "native:properties",
]);

export type StartShortcutTarget = SharedShortcutTarget;

export interface StartShortcut {
  node: FsNode;
  target: StartShortcutTarget;
}

export interface StartSeedResult {
  root: FsNode;
  created: number;
  preserved: number;
  skippedDeleted: number;
}

export function parseStartShortcutTarget(value: unknown): StartShortcutTarget | null {
  return parseSharedShortcut(value)?.target ?? null;
}

export function parseStartShortcut(node: FsNode): StartShortcut | null {
  if (node.kind !== "shortcut") return null;
  const target = parseStartShortcutTarget(node.metadata[START_SHORTCUT_METADATA_KEY]);
  return target ? { node, target } : null;
}

export function startShortcutTargetIdentity(target: StartShortcutTarget): string {
  switch (target.kind) {
    case "native": return `native:${target.handlerId}`;
    case "element": return `element:${target.elementId}|tile:${target.tileId ?? ""}|view:${target.view ?? ""}`;
    case "node": return `node:${target.nodeId}`;
    case "url": return `url:${target.url}`;
  }
}

function shortcutMetadata(target: StartShortcutTarget): JsonValue {
  return sharedShortcutMetadata(target)[START_SHORTCUT_METADATA_KEY] ?? null;
}

function stringList(value: JsonValue | undefined): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0));
}

function stringMap(value: JsonValue | undefined): Map<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Map();
  return new Map(
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

function managedFolderIdsValue(folderIds: ReadonlyMap<string, string>): JsonValue | null {
  const entries = [...folderIds.entries()].sort(([left], [right]) => left.localeCompare(right));
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

async function persistManagedFolderIds(
  fs: FsService,
  rootId: string,
  folderIds: ReadonlyMap<string, string>,
): Promise<void> {
  await fs.setMetadata(rootId, { [START_MANAGED_FOLDER_IDS_KEY]: managedFolderIdsValue(folderIds) });
}

function seedFolderForNative(app: NativeAppDefinition): "Accessories" | null {
  return FORMER_SYSTEM_NATIVE_HANDLERS.has(app.handlerId) ? null : "Accessories";
}

function safeEntryName(name: string): string {
  const cleaned = name.replace(/[\\/\0]/gu, " ").replace(/\s+/gu, " ").trim();
  return cleaned || "Shortcut";
}

async function ensureStartRoot(fs: FsService): Promise<FsNode> {
  const existing = await fs.resolvePath(START_MENU_PATH);
  if (existing) {
    if (existing.kind !== "directory") throw new Error(`${START_MENU_PATH} exists but is not a directory`);
    return existing;
  }
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  let system = await fs.resolvePath("/System");
  if (!system) system = await fs.mkdir(root.id, "System");
  if (system.kind !== "directory") throw new Error("/System exists but is not a directory");
  return fs.mkdir(system.id, START_MENU_NAME);
}

/**
 * Resolve a canonical managed Start category without claiming ownership of an
 * ambiguous same-name resource. When Shell creates a category, its stable NodeId
 * is recorded on the Start root. Existing same-name directories are never
 * adopted, so copying/replacing a directory cannot transfer managed ownership.
 * A non-directory collision is preserved and represented as a blocked placement
 * for this reconciliation pass; callers may continue reconciling independent
 * categories without mutating or relabeling it.
 */
async function resolveChildDirectory(
  fs: FsService,
  parent: FsNode,
  name: string,
  managedFolderIds: Map<string, string>,
): Promise<FsNode | null> {
  const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
  const existing = children.find((node) => node.name === name);
  if (existing) return existing.kind === "directory" ? existing : null;

  const created = await fs.mkdir(parent.id, name);
  managedFolderIds.set(name, created.id);
  try {
    await persistManagedFolderIds(fs, parent.id, managedFolderIds);
  } catch (error) {
    managedFolderIds.delete(name);
    throw error;
  }
  return created;
}

async function uniqueChildName(fs: FsService, parentId: string, preferred: string): Promise<string> {
  const used = new Set((await fs.list(parentId, { includeHidden: true, sort: "name" })).map((node) => node.name));
  if (!used.has(preferred)) return preferred;
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${preferred} (${index})`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Could not allocate a unique Start Menu name for ${preferred}`);
}

async function scanStartTree(fs: FsService, root: FsNode): Promise<Map<string, StartShortcut>> {
  const found = new Map<string, StartShortcut>();
  const queue = [root];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const directory = queue.shift();
    if (!directory || visited.has(directory.id)) continue;
    visited.add(directory.id);
    const children = await fs.list(directory.id, { includeHidden: true, sort: "name" });
    for (const child of children) {
      if (child.kind === "directory") {
        queue.push(child);
        continue;
      }
      const shortcut = parseStartShortcut(child);
      if (!shortcut) continue;
      const identity = startShortcutTargetIdentity(shortcut.target);
      if (!found.has(identity)) found.set(identity, shortcut);
    }
  }
  return found;
}

interface SeedSpec {
  identity: string;
  name: string;
  folder: "Accessories" | "Neutron" | null;
  target: StartShortcutTarget;
}

function nativeSeedSpec(app: NativeAppDefinition): SeedSpec {
  const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
  return {
    identity: startShortcutTargetIdentity(target),
    name: safeEntryName(app.name),
    folder: seedFolderForNative(app),
    target,
  };
}

function desiredSeeds(nativeApps: readonly NativeAppDefinition[], elements: readonly ExternalElement[]): SeedSpec[] {
  const native = nativeApps
    .filter((app) => app.runtimeOnly !== true && !RETIRED_DEFAULT_START_NATIVE_HANDLERS.has(app.handlerId))
    .map(nativeSeedSpec);
  const neutron = elements.map<SeedSpec>((element) => {
    const target: StartShortcutTarget = { kind: "element", elementId: element.id };
    return {
      identity: startShortcutTargetIdentity(target),
      name: safeEntryName(element.name),
      folder: "Neutron",
      target,
    };
  });
  return [...native, ...neutron];
}

function isExactManagedSeed(node: FsNode, spec: SeedSpec): boolean {
  if (node.kind !== "shortcut" || node.name !== spec.name || node.size !== 0 || node.mime !== undefined) return false;
  const metadataKeys = Object.keys(node.metadata);
  if (metadataKeys.length !== 1 || metadataKeys[0] !== START_SHORTCUT_METADATA_KEY) return false;
  const shortcut = parseStartShortcut(node);
  return !!shortcut && startShortcutTargetIdentity(shortcut.target) === spec.identity;
}

/**
 * Retire the former managed Start `System` category only when the durable
 * Start-root provenance map names that exact stable directory NodeId and its
 * contents are still the untouched canonical defaults. The v1 seed ledger,
 * folder name, shortcut shape, and timestamps are not directory ownership
 * evidence. Pre-provenance and otherwise ambiguous folders fail closed.
 */
async function migrateProvablyManagedRetiredSystemFolder(
  fs: FsService,
  root: FsNode,
  nativeApps: readonly NativeAppDefinition[],
  seeded: ReadonlySet<string>,
  managedFolderIds: Map<string, string>,
): Promise<void> {
  const registeredSystemId = managedFolderIds.get("System");
  if (!registeredSystemId) return;

  const specs = nativeApps
    .filter((app) => app.runtimeOnly !== true && FORMER_SYSTEM_NATIVE_HANDLERS.has(app.handlerId))
    .map(nativeSeedSpec);
  if (specs.length !== FORMER_SYSTEM_NATIVE_HANDLERS.size) return;

  const rootChildren = await fs.list(root.id, { includeHidden: true, sort: "name" });
  const system = rootChildren.find((node) => node.id === registeredSystemId);
  if (!system || system.kind !== "directory" || system.name !== "System") return;
  if (Object.keys(system.metadata).length !== 0) return;
  if (specs.some((spec) => !seeded.has(spec.identity))) return;
  if (specs.some((spec) => rootChildren.some((node) => node.id !== system.id && node.name === spec.name))) return;

  const systemChildren = await fs.list(system.id, { includeHidden: true, sort: "name" });
  if (systemChildren.length !== specs.length) return;

  const candidates: FsNode[] = [];
  for (const spec of specs) {
    const candidate = systemChildren.find((node) => node.name === spec.name);
    if (!candidate || !isExactManagedSeed(candidate, spec)) return;
    candidates.push(candidate);
  }

  for (const candidate of candidates) await fs.move(candidate.id, root.id);
  await fs.remove(system.id);
  managedFolderIds.delete("System");
  await persistManagedFolderIds(fs, root.id, managedFolderIds);
}

function shouldRetireManagedNativeSeed(app: NativeAppDefinition): boolean {
  return app.runtimeOnly === true || RETIRED_DEFAULT_START_NATIVE_HANDLERS.has(app.handlerId);
}

/**
 * Some native applications cease to be managed Start defaults either because
 * they became runtime-only hosts or because the default Start inventory changed.
 * Retire only an exact old managed default: the durable seed ledger must prove
 * that identity was seeded, and the shortcut must still have its canonical
 * direct folder/name plus untouched shortcut-only metadata/content. Renamed,
 * moved, deleted, content-bearing, metadata-customized, or user-created entries
 * are intentionally preserved because their managed ownership is not provable
 * from the durable reconciliation state.
 *
 * Once an identity is retired from the managed inventory, consume its old ledger
 * entry. The inventory filter already prevents recreation, while dropping stale
 * target-only provenance prevents a future user-created exact equivalent from
 * being falsely claimed as the old managed node.
 */
async function retireManagedNativeSeeds(
  fs: FsService,
  root: FsNode,
  nativeApps: readonly NativeAppDefinition[],
  seeded: Set<string>,
): Promise<boolean> {
  const rootChildren = await fs.list(root.id, { includeHidden: true, sort: "name" });
  let changedManifest = false;

  for (const app of nativeApps) {
    if (!shouldRetireManagedNativeSeed(app)) continue;
    const spec = nativeSeedSpec(app);
    if (!seeded.has(spec.identity)) continue;

    let parent: FsNode | null = root;
    if (spec.folder !== null) {
      const folder = rootChildren.find((node) => node.name === spec.folder);
      parent = folder?.kind === "directory" ? folder : null;
    }

    if (parent) {
      const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
      const candidate = children.find((node) => node.name === spec.name);
      if (candidate && isExactManagedSeed(candidate, spec)) await fs.remove(candidate.id);
    }

    seeded.delete(spec.identity);
    changedManifest = true;
  }

  return changedManifest;
}

/**
 * Conservative reconciliation: stable target identity is authoritative. Existing
 * shortcuts anywhere under Start Menu are preserved, including user renames and
 * moves. Once an identity has been seeded, its later absence is treated as an
 * intentional deletion and is not recreated. Newly discovered identities are
 * seeded exactly once. Exact previously-managed native defaults that are no
 * longer in the managed inventory are retired without weakening those
 * user-customization semantics. Managed category ownership is recorded by stable
 * NodeId when Shell creates a category. The retired `System` folder migrates only
 * when that exact directory NodeId is already present in durable provenance and
 * the legacy contents remain exact. Historical pre-provenance folders cannot be
 * adopted from name, shape, shortcut identity, or timestamps and remain in place.
 */
export async function reconcileStartMenu(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): Promise<StartSeedResult> {
  const root = await ensureStartRoot(fs);
  const seeded = stringList(root.metadata[START_SEEDED_IDENTITIES_KEY]);
  const managedFolderIds = stringMap(root.metadata[START_MANAGED_FOLDER_IDS_KEY]);
  await migrateProvablyManagedRetiredSystemFolder(fs, root, nativeApps, seeded, managedFolderIds);
  let changedManifest = await retireManagedNativeSeeds(fs, root, nativeApps, seeded);
  const existing = await scanStartTree(fs, root);
  let created = 0;
  let preserved = 0;
  let skippedDeleted = 0;
  const folders = new Map<string, FsNode | null>();

  for (const spec of desiredSeeds(nativeApps, elements)) {
    if (existing.has(spec.identity)) {
      preserved += 1;
      if (!seeded.has(spec.identity)) {
        seeded.add(spec.identity);
        changedManifest = true;
      }
      continue;
    }
    if (seeded.has(spec.identity)) {
      skippedDeleted += 1;
      continue;
    }

    let folder = root;
    if (spec.folder !== null) {
      let resolved: FsNode | null;
      if (folders.has(spec.folder)) {
        resolved = folders.get(spec.folder) ?? null;
      } else {
        resolved = await resolveChildDirectory(fs, root, spec.folder, managedFolderIds);
        folders.set(spec.folder, resolved);
      }
      if (!resolved) continue;
      folder = resolved;
    }
    const name = await uniqueChildName(fs, folder.id, spec.name);
    const node = await fs.createFile(folder.id, name, {
      kind: "shortcut",
      metadata: { [START_SHORTCUT_METADATA_KEY]: shortcutMetadata(spec.target) },
    });
    existing.set(spec.identity, { node, target: spec.target });
    seeded.add(spec.identity);
    created += 1;
    changedManifest = true;
  }

  if (changedManifest) {
    await fs.setMetadata(root.id, {
      [START_SEEDED_IDENTITIES_KEY]: [...seeded].sort(),
    });
  }
  const refreshed = await fs.stat(root.id);
  return { root: refreshed, created, preserved, skippedDeleted };
}

export async function listStartMenuFolder(fs: FsService, folderId: string): Promise<FsNode[]> {
  const folder = await fs.stat(folderId);
  if (folder.kind !== "directory") throw new Error(`${folder.name} is not a Start Menu folder`);
  return fs.list(folder.id, { includeHidden: false, sort: "name" });
}
