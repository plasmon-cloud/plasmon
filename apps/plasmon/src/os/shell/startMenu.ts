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

function seedFolderForNative(app: NativeAppDefinition): "Accessories" | "System" {
  const systemHandlers = new Set<HandlerId>(["native:settings", "native:explorer", "native:properties"]);
  return systemHandlers.has(app.handlerId) ? "System" : "Accessories";
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
  folder: "Accessories" | "System" | "Neutron";
  target: StartShortcutTarget;
}

function desiredSeeds(nativeApps: readonly NativeAppDefinition[], elements: readonly ExternalElement[]): SeedSpec[] {
  const native = nativeApps.map<SeedSpec>((app) => {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    return {
      identity: startShortcutTargetIdentity(target),
      name: safeEntryName(app.name),
      folder: seedFolderForNative(app),
      target,
    };
  });
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
 * Conservative reconciliation: stable target identity is authoritative. Existing
 * shortcuts anywhere under Start Menu are preserved, including user renames and
 * moves. Once an identity has been seeded, its later absence is treated as an
 * intentional deletion and is not recreated. Newly discovered identities are
 * seeded exactly once.
 */
export async function reconcileStartMenu(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): Promise<StartSeedResult> {
  const root = await ensureStartRoot(fs);
  const existing = await scanStartTree(fs, root);
  const seeded = stringList(root.metadata[START_SEEDED_IDENTITIES_KEY]);
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
    let folder = folders.get(spec.folder);
    if (!folder) {
      folder = await ensureChildDirectory(fs, root, spec.folder);
      folders.set(spec.folder, folder);
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
