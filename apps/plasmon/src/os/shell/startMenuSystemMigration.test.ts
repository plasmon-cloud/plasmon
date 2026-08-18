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
  START_MANAGED_FOLDER_METADATA_KEY,
  START_MENU_PATH,
  START_SEEDED_IDENTITIES_KEY,
  START_SHORTCUT_METADATA_KEY,
  parseStartShortcut,
  reconcileStartMenu,
  startShortcutTargetIdentity,
  type StartShortcut,
  type StartShortcutTarget,
} from "./startMenu.ts";

const retiredSystemApps: readonly NativeAppDefinition[] = [
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

function legacyShortcutMetadata(target: StartShortcutTarget): Record<string, JsonValue> {
  const encoded = sharedShortcutMetadata(target)[START_SHORTCUT_METADATA_KEY];
  if (encoded === undefined) throw new Error("shared shortcut encoder omitted shortcut metadata");
  return { [START_SHORTCUT_METADATA_KEY]: encoded };
}

async function allShortcuts(fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"]): Promise<StartShortcut[]> {
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

async function createLegacyManagedSystemState(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
  options: { provenManagedFolder?: boolean } = {},
): Promise<{ root: FsNode; system: FsNode; shortcuts: Map<string, FsNode> }> {
  const { root } = await reconcileStartMenu(fs, [], []);
  let system = await fs.mkdir(root.id, "System");
  if (options.provenManagedFolder) {
    system = await fs.setMetadata(system.id, { [START_MANAGED_FOLDER_METADATA_KEY]: "System" });
  }
  const shortcuts = new Map<string, FsNode>();
  const seeded: string[] = [];

  for (const app of retiredSystemApps) {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    const identity = startShortcutTargetIdentity(target);
    const node = await fs.createFile(system.id, app.name, {
      kind: "shortcut",
      metadata: legacyShortcutMetadata(target),
    });
    shortcuts.set(identity, node);
    seeded.push(identity);
  }

  await fs.setMetadata(root.id, { [START_SEEDED_IDENTITIES_KEY]: seeded.sort() });
  return { root: await fs.stat(root.id), system: await fs.stat(system.id), shortcuts };
}

function nativeIdentity(app: NativeAppDefinition): string {
  return startShortcutTargetIdentity({ kind: "native", handlerId: app.handlerId });
}

test("fresh reconciliation keeps retired System applications at Start root without creating the managed System folder", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const result = await reconcileStartMenu(environment.services.fs, retiredSystemApps, []);
    expect(result.created).toBe(retiredSystemApps.length);
    expect(await environment.node(`${START_MENU_PATH}/System`)).toBeNull();

    const rootChildren = await environment.services.fs.list(result.root.id, { includeHidden: true, sort: "name" });
    expect(rootChildren.filter((node) => node.kind === "shortcut").map((node) => node.name)).toEqual([
      "Explorer",
      "Properties",
      "Settings",
    ]);
    for (const app of retiredSystemApps) {
      const node = await environment.node(`${START_MENU_PATH}/${app.name}`);
      expect(parseStartShortcut(node!)?.target).toEqual({ kind: "native", handlerId: app.handlerId });
    }
  } finally {
    environment.dispose();
  }
});

test("new managed Start categories record durable folder provenance", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    await reconcileStartMenu(environment.services.fs, [accessoryApp], []);
    const accessories = await environment.node(`${START_MENU_PATH}/Accessories`);
    expect(accessories?.metadata[START_MANAGED_FOLDER_METADATA_KEY]).toBe("Accessories");
  } finally {
    environment.dispose();
  }
});

test("existing same-name user folders are used without being adopted as managed", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const { root } = await reconcileStartMenu(environment.services.fs, [], []);
    const userAccessories = await environment.services.fs.mkdir(root.id, "Accessories");
    await environment.services.fs.createFile(userAccessories.id, "Keep me.txt", { mime: "text/plain" });

    await reconcileStartMenu(environment.services.fs, [accessoryApp], []);
    const after = await environment.node(`${START_MENU_PATH}/Accessories`);
    expect(after?.id).toBe(userAccessories.id);
    expect(after?.metadata[START_MANAGED_FOLDER_METADATA_KEY]).toBeUndefined();
    expect(await environment.node(`${START_MENU_PATH}/Accessories/Keep me.txt`)).not.toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Accessories/Text`)).not.toBeNull();
  } finally {
    environment.dispose();
  }
});

test("provably managed legacy System defaults migrate to Start root without duplicates and preserve NodeIds", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const legacy = await createLegacyManagedSystemState(fs, { provenManagedFolder: true });
    const result = await reconcileStartMenu(fs, retiredSystemApps, []);

    expect(result.created).toBe(0);
    expect(result.preserved).toBe(retiredSystemApps.length);
    expect(await environment.node(`${START_MENU_PATH}/System`)).toBeNull();

    const shortcuts = await allShortcuts(fs);
    expect(shortcuts).toHaveLength(retiredSystemApps.length);
    for (const app of retiredSystemApps) {
      const identity = nativeIdentity(app);
      const migrated = shortcuts.filter((shortcut) => startShortcutTargetIdentity(shortcut.target) === identity);
      expect(migrated).toHaveLength(1);
      expect(migrated[0]?.node.id).toBe(legacy.shortcuts.get(identity)?.id);
      expect(await fs.pathOf(migrated[0]!.node.id)).toBe(`${START_MENU_PATH}/${app.name}`);
    }

    const revisionAfterMigration = await fs.revision();
    const second = await reconcileStartMenu(fs, retiredSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(retiredSystemApps.length);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterMigration);
  } finally {
    environment.dispose();
  }
});

test("unmarked legacy System defaults are preserved when directory ownership cannot be proven", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs);
    const revisionBefore = await environment.services.fs.revision();
    const result = await reconcileStartMenu(environment.services.fs, retiredSystemApps, []);

    expect(result.created).toBe(0);
    expect(result.preserved).toBe(retiredSystemApps.length);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(legacy.system.id);

    const shortcuts = await allShortcuts(environment.services.fs);
    expect(shortcuts).toHaveLength(retiredSystemApps.length);
    for (const app of retiredSystemApps) {
      const identity = nativeIdentity(app);
      const preserved = shortcuts.filter((shortcut) => startShortcutTargetIdentity(shortcut.target) === identity);
      expect(preserved).toHaveLength(1);
      expect(preserved[0]?.node.id).toBe(legacy.shortcuts.get(identity)?.id);
      expect(await environment.services.fs.pathOf(preserved[0]!.node.id)).toBe(
        `${START_MENU_PATH}/System/${app.name}`,
      );
    }
    expect(await environment.services.fs.revision()).toBe(revisionBefore);
  } finally {
    environment.dispose();
  }
});

test("user-created replacement System folder is never mistaken for the retired managed directory", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs);
    const fs = environment.services.fs;

    await fs.rename(legacy.system.id, "Legacy System");
    const replacement = await fs.mkdir(legacy.root.id, "System");
    for (const shortcut of legacy.shortcuts.values()) {
      await fs.move(shortcut.id, replacement.id);
    }

    const revisionBefore = await fs.revision();
    const result = await reconcileStartMenu(fs, retiredSystemApps, []);

    expect(result.created).toBe(0);
    expect(result.preserved).toBe(retiredSystemApps.length);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(replacement.id);
    expect((await environment.node(`${START_MENU_PATH}/Legacy System`))?.id).toBe(legacy.system.id);

    for (const app of retiredSystemApps) {
      const identity = nativeIdentity(app);
      const shortcut = legacy.shortcuts.get(identity)!;
      expect(await fs.pathOf(shortcut.id)).toBe(`${START_MENU_PATH}/System/${app.name}`);
    }
    expect(await fs.revision()).toBe(revisionBefore);
  } finally {
    environment.dispose();
  }
});

test("legacy customization preserves renamed moved and deleted defaults and never deletes the customized managed System folder", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs, { provenManagedFolder: true });
    const fs = environment.services.fs;
    const settingsId = nativeIdentity(retiredSystemApps[0]!);
    const explorerId = nativeIdentity(retiredSystemApps[1]!);
    const propertiesId = nativeIdentity(retiredSystemApps[2]!);
    const settings = legacy.shortcuts.get(settingsId)!;
    const explorer = legacy.shortcuts.get(explorerId)!;
    const properties = legacy.shortcuts.get(propertiesId)!;

    await fs.rename(settings.id, "My Settings");
    const tools = await fs.mkdir(legacy.root.id, "My Tools");
    await fs.move(explorer.id, tools.id);
    await fs.remove(properties.id);
    await fs.createFile(legacy.system.id, "Keep me.txt", { mime: "text/plain" });
    await fs.setMetadata(legacy.system.id, { "user.organized": true });

    const result = await reconcileStartMenu(fs, retiredSystemApps, []);
    expect(result.skippedDeleted).toBe(1);
    expect((await fs.stat(settings.id)).name).toBe("My Settings");
    expect(await fs.pathOf(settings.id)).toBe(`${START_MENU_PATH}/System/My Settings`);
    expect(await fs.pathOf(explorer.id)).toBe(`${START_MENU_PATH}/My Tools/Explorer`);
    expect(await environment.node(`${START_MENU_PATH}/System/Keep me.txt`)).not.toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/System`)).not.toBeNull();

    const shortcuts = await allShortcuts(fs);
    expect(shortcuts.some((shortcut) => shortcut.node.id === properties.id)).toBe(false);
    expect(shortcuts.some((shortcut) => startShortcutTargetIdentity(shortcut.target) === propertiesId)).toBe(false);
    expect(shortcuts.filter((shortcut) => startShortcutTargetIdentity(shortcut.target) === settingsId)).toHaveLength(1);
    expect(shortcuts.filter((shortcut) => startShortcutTargetIdentity(shortcut.target) === explorerId)).toHaveLength(1);
  } finally {
    environment.dispose();
  }
});

test("preserving an unowned legacy System folder remains idempotent", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    await createLegacyManagedSystemState(environment.services.fs);
    await reconcileStartMenu(environment.services.fs, retiredSystemApps, []);
    const revisionAfterFirstPass = await environment.services.fs.revision();
    const pathsAfterFirstPass = await Promise.all(
      (await allShortcuts(environment.services.fs)).map((shortcut) => environment.services.fs.pathOf(shortcut.node.id)),
    );

    const second = await reconcileStartMenu(environment.services.fs, retiredSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(retiredSystemApps.length);
    expect(second.skippedDeleted).toBe(0);
    expect(await environment.services.fs.revision()).toBe(revisionAfterFirstPass);
    expect(await Promise.all(
      (await allShortcuts(environment.services.fs)).map((shortcut) => environment.services.fs.pathOf(shortcut.node.id)),
    )).toEqual(pathsAfterFirstPass);
  } finally {
    environment.dispose();
  }
});
