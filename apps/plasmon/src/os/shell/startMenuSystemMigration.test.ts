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

const settingsApp = formerSystemApps[0]!;
const explorerApp = formerSystemApps[1]!;
const propertiesApp = formerSystemApps[2]!;

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
): Promise<{ root: FsNode; system: FsNode; shortcuts: Map<string, FsNode> }> {
  const { root } = await reconcileStartMenu(fs, [], []);
  const system = await fs.mkdir(root.id, "System");
  const shortcuts = new Map<string, FsNode>();
  const seeded: string[] = [];

  for (const app of formerSystemApps) {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    const identity = startShortcutTargetIdentity(target);
    const node = await fs.createFile(system.id, app.name, {
      kind: "shortcut",
      metadata: legacyShortcutMetadata(target),
    });
    shortcuts.set(identity, node);
    seeded.push(identity);
  }

  // The released v1 reconciler wrote the seed ledger after creating the folder
  // and its shortcuts. Ensure the fixture preserves that durable ordering even
  // on millisecond-resolution clocks.
  let rootBeforeLedger = await fs.stat(root.id);
  while (Date.now() <= system.createdAt) await new Promise((resolve) => setTimeout(resolve, 1));
  await fs.setMetadata(root.id, { [START_SEEDED_IDENTITIES_KEY]: seeded.sort() });
  rootBeforeLedger = await fs.stat(root.id);
  return { root: rootBeforeLedger, system, shortcuts };
}

async function createPriorRootManagedState(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
): Promise<{ root: FsNode; shortcuts: Map<string, FsNode> }> {
  const { root } = await reconcileStartMenu(fs, [], []);
  const shortcuts = new Map<string, FsNode>();
  const seeded: string[] = [];

  for (const app of formerSystemApps) {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    const identity = startShortcutTargetIdentity(target);
    const node = await fs.createFile(root.id, app.name, {
      kind: "shortcut",
      metadata: legacyShortcutMetadata(target),
    });
    shortcuts.set(identity, node);
    seeded.push(identity);
  }

  await fs.setMetadata(root.id, { [START_SEEDED_IDENTITIES_KEY]: seeded.sort() });
  return { root: await fs.stat(root.id), shortcuts };
}

function nativeIdentity(app: NativeAppDefinition): string {
  return startShortcutTargetIdentity({ kind: "native", handlerId: app.handlerId });
}

async function seededIdentities(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
): Promise<string[]> {
  const root = await fs.resolvePath(START_MENU_PATH);
  if (!root) return [];
  const value = root.metadata[START_SEEDED_IDENTITIES_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : [];
}

test("fresh reconciliation omits managed Settings and Properties defaults while keeping Explorer at Start root", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const result = await reconcileStartMenu(environment.services.fs, formerSystemApps, []);
    expect(result.created).toBe(1);
    expect(await environment.node(`${START_MENU_PATH}/System`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Settings`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Properties`)).toBeNull();

    const explorer = await environment.node(`${START_MENU_PATH}/Explorer`);
    expect(parseStartShortcut(explorer!)?.target).toEqual({ kind: "native", handlerId: explorerApp.handlerId });
    const rootChildren = await environment.services.fs.list(result.root.id, { includeHidden: true, sort: "name" });
    expect(rootChildren.filter((node) => node.kind === "shortcut").map((node) => node.name)).toEqual(["Explorer"]);
    expect(await seededIdentities(environment.services.fs)).toEqual([nativeIdentity(explorerApp)]);
  } finally {
    environment.dispose();
  }
});

test("upgrade retires only exact untouched ledger-backed root Settings and Properties defaults", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const prior = await createPriorRootManagedState(environment.services.fs);
    const settingsId = nativeIdentity(settingsApp);
    const explorerId = nativeIdentity(explorerApp);
    const propertiesId = nativeIdentity(propertiesApp);

    const first = await reconcileStartMenu(environment.services.fs, formerSystemApps, []);
    expect(await environment.node(`${START_MENU_PATH}/Settings`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Properties`)).toBeNull();
    expect((await environment.services.fs.stat(prior.shortcuts.get(explorerId)!.id)).id).toBe(prior.shortcuts.get(explorerId)!.id);
    expect(await environment.services.fs.pathOf(prior.shortcuts.get(explorerId)!.id)).toBe(`${START_MENU_PATH}/Explorer`);
    expect(first.created).toBe(0);
    expect(first.preserved).toBe(1);
    expect(await seededIdentities(environment.services.fs)).toEqual([explorerId]);

    expect(await environment.services.fs.stat(prior.shortcuts.get(settingsId)!.id).then(() => true, () => false)).toBe(false);
    expect(await environment.services.fs.stat(prior.shortcuts.get(propertiesId)!.id).then(() => true, () => false)).toBe(false);

    const revisionAfterRetirement = await environment.services.fs.revision();
    const second = await reconcileStartMenu(environment.services.fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await environment.services.fs.revision()).toBe(revisionAfterRetirement);
  } finally {
    environment.dispose();
  }
});

test("retired managed defaults stay deleted and exact later user-created equivalents are preserved", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const prior = await createPriorRootManagedState(environment.services.fs);
    const fs = environment.services.fs;
    const settingsId = nativeIdentity(settingsApp);
    const propertiesId = nativeIdentity(propertiesApp);

    await fs.remove(prior.shortcuts.get(settingsId)!.id);
    await fs.remove(prior.shortcuts.get(propertiesId)!.id);
    await reconcileStartMenu(fs, formerSystemApps, []);
    expect(await environment.node(`${START_MENU_PATH}/Settings`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Properties`)).toBeNull();
    expect(await seededIdentities(fs)).toEqual([nativeIdentity(explorerApp)]);

    const root = await fs.resolvePath(START_MENU_PATH);
    if (!root || root.kind !== "directory") throw new Error("Start Menu root is unavailable");
    const userSettings = await fs.createFile(root.id, "Settings", {
      kind: "shortcut",
      metadata: legacyShortcutMetadata({ kind: "native", handlerId: settingsApp.handlerId }),
    });
    const userProperties = await fs.createFile(root.id, "Properties", {
      kind: "shortcut",
      metadata: legacyShortcutMetadata({ kind: "native", handlerId: propertiesApp.handlerId }),
    });

    await reconcileStartMenu(fs, formerSystemApps, []);
    expect((await fs.stat(userSettings.id)).id).toBe(userSettings.id);
    expect((await fs.stat(userProperties.id)).id).toBe(userProperties.id);
    expect(await fs.pathOf(userSettings.id)).toBe(`${START_MENU_PATH}/Settings`);
    expect(await fs.pathOf(userProperties.id)).toBe(`${START_MENU_PATH}/Properties`);
  } finally {
    environment.dispose();
  }
});

test("upgrade preserves renamed moved and metadata-customized Settings and Properties shortcuts", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const prior = await createPriorRootManagedState(environment.services.fs);
    const fs = environment.services.fs;
    const settings = prior.shortcuts.get(nativeIdentity(settingsApp))!;
    const properties = prior.shortcuts.get(nativeIdentity(propertiesApp))!;

    await fs.rename(settings.id, "My Settings");
    const tools = await fs.mkdir(prior.root.id, "My Tools");
    await fs.move(properties.id, tools.id);
    await fs.setMetadata(properties.id, { "user.start-note": "keep" });

    await reconcileStartMenu(fs, formerSystemApps, []);
    expect((await fs.stat(settings.id)).name).toBe("My Settings");
    expect(await fs.pathOf(settings.id)).toBe(`${START_MENU_PATH}/My Settings`);
    expect(await fs.pathOf(properties.id)).toBe(`${START_MENU_PATH}/My Tools/Properties`);
    expect((await fs.stat(properties.id)).metadata["user.start-note"]).toBe("keep");
    expect(await seededIdentities(fs)).toEqual([nativeIdentity(explorerApp)]);
  } finally {
    environment.dispose();
  }
});

test("upgrade preserves metadata-customized canonical Settings default", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const prior = await createPriorRootManagedState(environment.services.fs);
    const fs = environment.services.fs;
    const settings = prior.shortcuts.get(nativeIdentity(settingsApp))!;
    await fs.setMetadata(settings.id, { "user.start-note": "keep canonical" });

    await reconcileStartMenu(fs, formerSystemApps, []);
    expect((await fs.stat(settings.id)).metadata["user.start-note"]).toBe("keep canonical");
    expect(await fs.pathOf(settings.id)).toBe(`${START_MENU_PATH}/Settings`);
  } finally {
    environment.dispose();
  }
});

test("released v1 legacy System defaults backfill provenance and migrate once", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs);
    const fs = environment.services.fs;
    const settingsId = nativeIdentity(settingsApp);
    const explorerId = nativeIdentity(explorerApp);
    const propertiesId = nativeIdentity(propertiesApp);

    const first = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(first.created).toBe(0);
    expect(first.preserved).toBe(1);
    expect(await environment.node(`${START_MENU_PATH}/System`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Settings`)).toBeNull();
    expect(await environment.node(`${START_MENU_PATH}/Properties`)).toBeNull();

    const explorer = legacy.shortcuts.get(explorerId)!;
    expect((await fs.stat(explorer.id)).id).toBe(explorer.id);
    expect(await fs.pathOf(explorer.id)).toBe(`${START_MENU_PATH}/Explorer`);
    expect(await fs.stat(legacy.shortcuts.get(settingsId)!.id).then(() => true, () => false)).toBe(false);
    expect(await fs.stat(legacy.shortcuts.get(propertiesId)!.id).then(() => true, () => false)).toBe(false);
    expect(await seededIdentities(fs)).toEqual([explorerId]);

    const revisionAfterFirstPass = await fs.revision();
    const second = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterFirstPass);
    expect(await fs.pathOf(explorer.id)).toBe(`${START_MENU_PATH}/Explorer`);
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

    const result = await reconcileStartMenu(fs, formerSystemApps, []);

    expect(result.created).toBe(0);
    expect(result.preserved).toBe(1);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(replacement.id);
    expect((await environment.node(`${START_MENU_PATH}/Legacy System`))?.id).toBe(legacy.system.id);

    for (const app of formerSystemApps) {
      const identity = nativeIdentity(app);
      const shortcut = legacy.shortcuts.get(identity)!;
      expect(await fs.pathOf(shortcut.id)).toBe(`${START_MENU_PATH}/System/${app.name}`);
    }
  } finally {
    environment.dispose();
  }
});

test("legacy customization preserves renamed moved and deleted defaults and never deletes the customized System folder", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs);
    const fs = environment.services.fs;
    const settingsId = nativeIdentity(settingsApp);
    const explorerId = nativeIdentity(explorerApp);
    const propertiesId = nativeIdentity(propertiesApp);
    const settings = legacy.shortcuts.get(settingsId)!;
    const explorer = legacy.shortcuts.get(explorerId)!;
    const properties = legacy.shortcuts.get(propertiesId)!;

    await fs.rename(settings.id, "My Settings");
    const tools = await fs.mkdir(legacy.root.id, "My Tools");
    await fs.move(explorer.id, tools.id);
    await fs.remove(properties.id);
    await fs.createFile(legacy.system.id, "Keep me.txt", { mime: "text/plain" });
    await fs.setMetadata(legacy.system.id, { "user.organized": true });

    const result = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(result.skippedDeleted).toBe(0);
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

test("customized pre-provenance System preservation remains idempotent", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const legacy = await createLegacyManagedSystemState(environment.services.fs);
    await environment.services.fs.setMetadata(legacy.system.id, { "user.organized": true });
    await reconcileStartMenu(environment.services.fs, formerSystemApps, []);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(legacy.system.id);
    const revisionAfterFirstPass = await environment.services.fs.revision();
    const pathsAfterFirstPass = await Promise.all(
      (await allShortcuts(environment.services.fs)).map((shortcut) => environment.services.fs.pathOf(shortcut.node.id)),
    );

    const second = await reconcileStartMenu(environment.services.fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await environment.services.fs.revision()).toBe(revisionAfterFirstPass);
    expect(await Promise.all(
      (await allShortcuts(environment.services.fs)).map((shortcut) => environment.services.fs.pathOf(shortcut.node.id)),
    )).toEqual(pathsAfterFirstPass);
  } finally {
    environment.dispose();
  }
});