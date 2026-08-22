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
  reconcileStartMenu,
  startShortcutTargetIdentity,
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

function legacyShortcutMetadata(target: StartShortcutTarget): Record<string, JsonValue> {
  const encoded = sharedShortcutMetadata(target)[START_SHORTCUT_METADATA_KEY];
  if (encoded === undefined) throw new Error("shared shortcut encoder omitted shortcut metadata");
  return { [START_SHORTCUT_METADATA_KEY]: encoded };
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

async function createLegacySystemState(
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

  await fs.setMetadata(root.id, { [START_SEEDED_IDENTITIES_KEY]: seeded.sort() });
  return { root: await fs.stat(root.id), system, shortcuts };
}

async function createFlatRootManagedState(
  fs: ReturnType<typeof createHeadlessPlasmonEnvironment>["services"]["fs"],
): Promise<{ root: FsNode; shortcuts: Map<string, FsNode> }> {
  const { root } = await reconcileStartMenu(fs, [], []);
  const shortcuts = new Map<string, FsNode>();
  const seeded: string[] = [];

  for (const app of formerSystemApps) {
    const target: StartShortcutTarget = { kind: "native", handlerId: app.handlerId };
    const identity = startShortcutTargetIdentity(target);
    const shortcut = await fs.createFile(root.id, app.name, {
      kind: "shortcut",
      metadata: legacyShortcutMetadata(target),
    });
    shortcuts.set(identity, shortcut);
    seeded.push(identity);
  }

  await fs.setMetadata(root.id, { [START_SEEDED_IDENTITIES_KEY]: seeded.sort() });
  return { root: await fs.stat(root.id), shortcuts };
}

test("same-name Settings and Properties moved from legacy System to Start root are preserved", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const legacy = await createLegacySystemState(fs);
    const settingsId = nativeIdentity(formerSystemApps[0]!);
    const explorerId = nativeIdentity(formerSystemApps[1]!);
    const propertiesId = nativeIdentity(formerSystemApps[2]!);
    const settings = legacy.shortcuts.get(settingsId)!;
    const explorer = legacy.shortcuts.get(explorerId)!;
    const properties = legacy.shortcuts.get(propertiesId)!;

    await fs.move(settings.id, legacy.root.id);
    await fs.move(properties.id, legacy.root.id);

    const first = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(first.created).toBe(0);
    expect(first.preserved).toBe(1);
    expect(first.skippedDeleted).toBe(0);
    expect((await environment.node(`${START_MENU_PATH}/System`))?.id).toBe(legacy.system.id);
    expect((await fs.stat(settings.id)).id).toBe(settings.id);
    expect((await fs.stat(properties.id)).id).toBe(properties.id);
    expect(await fs.pathOf(settings.id)).toBe(`${START_MENU_PATH}/Settings`);
    expect(await fs.pathOf(properties.id)).toBe(`${START_MENU_PATH}/Properties`);
    expect(await fs.pathOf(explorer.id)).toBe(`${START_MENU_PATH}/System/Explorer`);
    expect(await seededIdentities(fs)).toEqual([explorerId]);

    const revisionAfterFirstPass = await fs.revision();
    const second = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterFirstPass);
    expect((await fs.stat(settings.id)).id).toBe(settings.id);
    expect((await fs.stat(properties.id)).id).toBe(properties.id);
    expect(await fs.pathOf(settings.id)).toBe(`${START_MENU_PATH}/Settings`);
    expect(await fs.pathOf(properties.id)).toBe(`${START_MENU_PATH}/Properties`);
  } finally {
    environment.dispose();
  }
});

test("unrelated user System folder does not suppress exact flat-root managed retirement", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const prior = await createFlatRootManagedState(fs);
    const settingsId = nativeIdentity(formerSystemApps[0]!);
    const explorerId = nativeIdentity(formerSystemApps[1]!);
    const propertiesId = nativeIdentity(formerSystemApps[2]!);
    const settings = prior.shortcuts.get(settingsId)!;
    const explorer = prior.shortcuts.get(explorerId)!;
    const properties = prior.shortcuts.get(propertiesId)!;

    const userSystem = await fs.mkdir(prior.root.id, "System");
    const keep = await fs.createFile(userSystem.id, "Keep me.txt", { mime: "text/plain" });

    const first = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(first.created).toBe(0);
    expect(first.preserved).toBe(1);
    expect(first.skippedDeleted).toBe(0);
    expect(await fs.stat(settings.id).then(() => true, () => false)).toBe(false);
    expect(await fs.stat(properties.id).then(() => true, () => false)).toBe(false);
    expect((await fs.stat(explorer.id)).id).toBe(explorer.id);
    expect(await fs.pathOf(explorer.id)).toBe(`${START_MENU_PATH}/Explorer`);
    expect((await fs.stat(userSystem.id)).id).toBe(userSystem.id);
    expect((await fs.stat(keep.id)).id).toBe(keep.id);
    expect(await fs.pathOf(keep.id)).toBe(`${START_MENU_PATH}/System/Keep me.txt`);
    expect(await seededIdentities(fs)).toEqual([explorerId]);

    const revisionAfterFirstPass = await fs.revision();
    const second = await reconcileStartMenu(fs, formerSystemApps, []);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterFirstPass);
    expect((await fs.stat(userSystem.id)).id).toBe(userSystem.id);
    expect((await fs.stat(keep.id)).id).toBe(keep.id);
  } finally {
    environment.dispose();
  }
});
