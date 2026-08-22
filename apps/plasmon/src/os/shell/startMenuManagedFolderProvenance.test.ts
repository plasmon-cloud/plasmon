// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type {
  FsNode,
  JsonValue,
  NativeAppDefinition,
} from "../contracts/index.ts";
import { shortcutMetadata as sharedShortcutMetadata } from "../fs/shortcut.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import {
  START_MANAGED_FOLDER_IDS_KEY,
  START_MENU_PATH,
  START_SEEDED_IDENTITIES_KEY,
  START_SHORTCUT_METADATA_KEY,
  parseStartShortcut,
  reconcileStartMenu,
  startShortcutTargetIdentity,
  type StartShortcut,
  type StartShortcutTarget,
} from "./startMenu.ts";

const formerSystemApps: readonly NativeAppDefinition[] = [
  {
    id: "native:settings",
    handlerId: "native:settings",
    name: "Settings",
    icon: "settings",
    defaultWindow: { width: 700, height: 500 },
    associations: [],
  },
  {
    id: "native:explorer",
    handlerId: "native:explorer",
    name: "Explorer",
    icon: "explorer",
    defaultWindow: { width: 900, height: 650 },
    associations: [],
  },
  {
    id: "native:properties",
    handlerId: "native:properties",
    name: "Properties",
    icon: "properties",
    defaultWindow: { width: 520, height: 520 },
    associations: [],
  },
];

const accessoryApp: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text",
  icon: "text",
  defaultWindow: { width: 800, height: 600 },
  associations: [],
};

function nativeIdentity(app: NativeAppDefinition): string {
  return startShortcutTargetIdentity({ kind: "native", handlerId: app.handlerId });
}

function legacyShortcutMetadata(target: StartShortcutTarget): Record<string, JsonValue> {
  const encoded = sharedShortcutMetadata(target)[START_SHORTCUT_METADATA_KEY];
  if (encoded === undefined) throw new Error("shared shortcut encoder omitted shortcut metadata");
  return { [START_SHORTCUT_METADATA_KEY]: encoded };
}

async function allShortcuts(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
): Promise<StartShortcut[]> {
  const root = await fs.resolvePath(START_MENU_PATH);
  if (!root) return [];
  const result: StartShortcut[] = [];
  const queue: FsNode[] = [root];
  while (queue.length > 0) {
    const folder = queue.shift();
    if (!folder) continue;
    for (const node of await fs.list(folder.id, { includeHidden: true, sort: "name" })) {
      if (node.kind === "directory") queue.push(node);
      else {
        const shortcut = parseStartShortcut(node);
        if (shortcut) result.push(shortcut);
      }
    }
  }
  return result;
}

async function createProvenLegacySystemState(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
): Promise<{ root: FsNode; system: FsNode; shortcuts: Map<string, FsNode> }> {
  const { root } = await reconcileStartMenu(fs, [], []);
  const system = await fs.mkdir(root.id, "System");
  const shortcuts = new Map<string, FsNode>();
  const seeded: string[] = [];

  for (const app of formerSystemApps) {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    const identity = startShortcutTargetIdentity(target);
    const shortcut = await fs.createFile(system.id, app.name, {
      kind: "shortcut",
      metadata: legacyShortcutMetadata(target),
    });
    shortcuts.set(identity, shortcut);
    seeded.push(identity);
  }

  await fs.setMetadata(root.id, {
    [START_SEEDED_IDENTITIES_KEY]: seeded.sort(),
    [START_MANAGED_FOLDER_IDS_KEY]: { System: system.id },
  });
  return { root: await fs.stat(root.id), system: await fs.stat(system.id), shortcuts };
}

async function nodeExists(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
  nodeId: string,
): Promise<boolean> {
  return fs.stat(nodeId).then(() => true, () => false);
}

test("Shell-created Start categories record stable NodeId provenance", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const result = await reconcileStartMenu(environment.services.fs, [accessoryApp], []);
    const accessories = await environment.node(`${START_MENU_PATH}/Accessories`);
    expect(accessories?.kind).toBe("directory");
    expect(result.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toEqual({ Accessories: accessories?.id });
    expect(accessories?.metadata[START_MANAGED_FOLDER_IDS_KEY]).toBeUndefined();

    const revision = await environment.services.fs.revision();
    const second = await reconcileStartMenu(environment.services.fs, [accessoryApp], []);
    expect(second.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toEqual({ Accessories: accessories?.id });
    expect(await environment.services.fs.revision()).toBe(revision);
  } finally {
    environment.dispose();
  }
});

test("existing same-name Start categories are never retroactively adopted as managed", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const { root } = await reconcileStartMenu(environment.services.fs, [], []);
    const userAccessories = await environment.services.fs.mkdir(root.id, "Accessories");
    await environment.services.fs.createFile(userAccessories.id, "Keep me.txt", { mime: "text/plain" });

    const result = await reconcileStartMenu(environment.services.fs, [accessoryApp], []);
    const after = await environment.node(`${START_MENU_PATH}/Accessories`);
    expect(after?.id).toBe(userAccessories.id);
    expect(result.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toBeUndefined();
    expect(await environment.node(`${START_MENU_PATH}/Accessories/Keep me.txt`)).not.toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Accessories/Text`)).not.toBeNull();
  } finally {
    environment.dispose();
  }
});

test("proven legacy System migration composes with current Settings and Properties retirement", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const legacy = await createProvenLegacySystemState(fs);
    const explorerId = nativeIdentity(formerSystemApps[1]!);
    const settingsId = nativeIdentity(formerSystemApps[0]!);
    const propertiesId = nativeIdentity(formerSystemApps[2]!);
    const originalExplorer = legacy.shortcuts.get(explorerId)!;

    const first = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(await environment.node(`${START_MENU_PATH}/System`)).toBeNull();
    expect(first.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toBeUndefined();
    expect(first.created).toBe(0);
    expect(first.preserved).toBe(1);
    expect(await environment.node(`${START_MENU_PATH}/Settings`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Properties`)).toBeNull();

    const explorer = await environment.node(`${START_MENU_PATH}/Explorer`);
    expect(explorer?.id).toBe(originalExplorer.id);
    expect(await fs.pathOf(originalExplorer.id)).toBe(`${START_MENU_PATH}/Explorer`);
    expect(await nodeExists(fs, legacy.shortcuts.get(settingsId)!.id)).toBe(false);
    expect(await nodeExists(fs, legacy.shortcuts.get(propertiesId)!.id)).toBe(false);

    const shortcuts = await allShortcuts(fs);
    expect(shortcuts).toHaveLength(1);
    expect(startShortcutTargetIdentity(shortcuts[0]!.target)).toBe(explorerId);
    expect(first.root.metadata[START_SEEDED_IDENTITIES_KEY]).toEqual([explorerId]);

    const revision = await fs.revision();
    const second = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revision);
  } finally {
    environment.dispose();
  }
});

test("customized proven System folders fail closed instead of being migrated", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const legacy = await createProvenLegacySystemState(fs);
    await fs.setMetadata(legacy.system.id, { "user.organized": true });

    const result = await reconcileStartMenu(fs, formerSystemApps, []);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(legacy.system.id);
    expect(result.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toEqual({ System: legacy.system.id });
    for (const app of formerSystemApps) {
      const shortcut = legacy.shortcuts.get(nativeIdentity(app))!;
      expect(await fs.pathOf(shortcut.id)).toBe(`${START_MENU_PATH}/System/${app.name}`);
    }
  } finally {
    environment.dispose();
  }
});

test("managed ownership does not transfer to a replacement System folder", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const legacy = await createProvenLegacySystemState(fs);
    await fs.rename(legacy.system.id, "Legacy System");
    const replacement = await fs.mkdir(legacy.root.id, "System");
    for (const shortcut of legacy.shortcuts.values()) await fs.move(shortcut.id, replacement.id);

    const result = await reconcileStartMenu(fs, formerSystemApps, []);
    expect((await environment.node(`${START_MENU_PATH}/Legacy System`))?.id).toBe(legacy.system.id);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(replacement.id);
    expect(result.root.metadata[START_MANAGED_FOLDER_IDS_KEY]).toEqual({ System: legacy.system.id });
    for (const app of formerSystemApps) {
      const shortcut = legacy.shortcuts.get(nativeIdentity(app))!;
      expect(await fs.pathOf(shortcut.id)).toBe(`${START_MENU_PATH}/System/${app.name}`);
    }
  } finally {
    environment.dispose();
  }
});
