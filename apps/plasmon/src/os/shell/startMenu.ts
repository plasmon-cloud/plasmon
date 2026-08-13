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

const RETIRED_SYSTEM_FOLDER_NAME = "System";
const RETIRED_SYSTEM_NATIVE_HANDLERS = new Set<HandlerId>([
  "native:settings",
  "native:explorer",
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

function seedFolderForNative(app: NativeAppDefinition): "Accessories" | null {
  return RETIRED_SYSTEM_NATIVE_HANDLERS.has(app.handlerId) ? null : "Accessories";
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

async function ensureChildDirectory(fs: FsService, parent: FsNode, name: string): Promise<FsNode> {
  const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
  const existing = children.find((node) => node.name === name);
  if (existing) {
    if (existing.kind !== "directory") throw new Error(`${name} exists in Start Menu but is not a directory`);
    return existing;
  }
  return fs.mkdir(parent.id, name);
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
    .filter((app) => app.runtimeOnly !== true)
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

/**
 * Retires the legacy managed `System` Start category only when its old default
 * shape is completely provable from durable reconciliation state: the folder
 * is the exact direct child, has no custom metadata/content, and contains one
 * canonical, previously-seeded shortcut for every currently supplied retired
 * System default. Any rename, move, deletion, extra content, or folder metadata
 * makes the folder user-customized and therefore untouchable.
 */
async function migrateRetiredSystemFolder(
  fs: FsService,
  root: FsNode,
  nativeApps: readonly NativeAppDefinition[],
  seeded: ReadonlySet<string>,
): Promise<void> {
  const specs = desiredSeeds(nativeApps, []).filter((spec) => spec.folder === null);
  if (specs.length === 0) return;

  const rootChildren = await fs.list(root.id, { includeHidden: true, sort: "name" });
  const system = rootChildren.find((node) => node.name === RETIRED_SYSTEM_FOLDER_NAME);
  if (!system || system.kind !== "directory") return;
  if (Object.keys(system.metadata).length !== 0) return;

  const children = await fs.list(system.id, { includeHidden: true, sort: "name" });
  if (children.length !== specs.length) return;

  const specsByIdentity = new Map(specs.map((spec) => [spec.identity, spec] as const));
  const matched = new Map<string, { node: FsNode; spec: SeedSpec }>();
  for (const child of children) {
    const shortcut = parseStartShortcut(child);
    if (!shortcut) return;
    const identity = startShortcutTargetIdentity(shortcut.target);
    const spec = specsByIdentity.get(identity);
    if (!spec || !seeded.has(identity) || child.name !== spec.name || matched.has(identity)) return;
    matched.set(identity, { node: child, spec });
  }
  if (matched.size !== specs.length) return;

  for (const { node, spec } of matched.values()) {
    const destinationName = await uniqueChildName(fs, root.id, spec.name);
    if (destinationName !== node.name) await fs.rename(node.id, destinationName);
    await fs.move(node.id, root.id);
  }

  if ((await fs.list(system.id, { includeHidden: true })).length === 0) {
    await fs.remove(system.id);
  }
}

function isExactManagedSeed(node: FsNode, spec: SeedSpec): boolean {
  if (node.kind !== "shortcut" || node.name !== spec.name || node.size !== 0 || node.mime !== undefined) return false;
  const metadataKeys = Object.keys(node.metadata);
  if (metadataKeys.length !== 1 || metadataKeys[0] !== START_SHORTCUT_METADATA_KEY) return false;
  const shortcut = parseStartShortcut(node);
  return !!shortcut && startShortcutTargetIdentity(shortcut.target) === spec.identity;
}

/**
 * Runtime hosts used to be seeded because Start projected every Process
 * definition. Retire only an exact old managed default: the durable seed ledger
 * must prove that identity was seeded, and the shortcut must still have its
 * canonical direct folder/name plus untouched shortcut-only metadata/content.
 * Renamed, moved, deleted, content-bearing, metadata-customized, or user-created
 * entries are intentionally preserved because their managed ownership is not
 * provable from the durable reconciliation state.
 */
async function retireManagedRuntimeOnlySeeds(
  fs: FsService,
  root: FsNode,
  nativeApps: readonly NativeAppDefinition[],
  seeded: ReadonlySet<string>,
): Promise<void> {
  const rootChildren = await fs.list(root.id, { includeHidden: true, sort: "name" });

  for (const app of nativeApps) {
    if (app.runtimeOnly !== true) continue;
    const spec = nativeSeedSpec(app);
    if (!seeded.has(spec.identity)) continue;

    let parent = root;
    if (spec.folder !== null) {
      const folder = rootChildren.find((node) => node.name === spec.folder);
      if (!folder || folder.kind !== "directory") continue;
      parent = folder;
    }

    const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
    const candidate = children.find((node) => node.name === spec.name);
    if (!candidate || !isExactManagedSeed(candidate, spec)) continue;
    await fs.remove(candidate.id);
  }
}

/**
 * Conservative reconciliation: stable target identity is authoritative. Existing
 * shortcuts anywhere under Start Menu are preserved, including user renames and
 * moves. Once an identity has been seeded, its later absence is treated as an
 * intentional deletion and is not recreated. Newly discovered identities are
 * seeded exactly once. Exact previously-managed defaults that are now classified
 * runtime-only are retired without weakening those user-customization semantics.
 */
export async function reconcileStartMenu(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): Promise<StartSeedResult> {
  const root = await ensureStartRoot(fs);
  const seeded = stringList(root.metadata[START_SEEDED_IDENTITIES_KEY]);
  await migrateRetiredSystemFolder(fs, root, nativeApps, seeded);
  await retireManagedRuntimeOnlySeeds(fs, root, nativeApps, seeded);
  const existing = await scanStartTree(fs, root);
  let created = 0;
  let preserved = 0;
  let skippedDeleted = 0;
  let changedManifest = false;
  const folders = new Map<string, FsNode>();

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
      const cached = folders.get(spec.folder);
      if (cached) folder = cached;
      else {
        folder = await ensureChildDirectory(fs, root, spec.folder);
        folders.set(spec.folder, folder);
      }
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
