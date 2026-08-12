import { test } from "bun:test";
import assert from "node:assert/strict";
import type {
  AssociationRegistry,
  AssociationRule,
  ExternalElement,
  HandlerDefinition,
  HandlerId,
  NativeAppDefinition,
  NeutronBridge,
  OpenService,
  OpenTarget,
  ProcessController,
  ProcessId,
  ProcessRecord,
} from "../contracts/index.ts";
import { MemoryFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import {
  DEMO_SEED_LEDGER_KEY,
  ManagedFsService,
  NeutronProjectionService,
  START_MENU_PATH,
  TRASH_PATH,
  TrashService,
  bootstrapFilesystem,
  type FilesystemSeedSpec,
} from "./managed.ts";
import { FilesystemOpenDispatcher } from "./openDispatcher.ts";
import { ProtectedManagedFsService } from "./protectedService.ts";
import {
  NEUTRON_APP_MIME,
  SYSTEM_APP_MIME,
  classifyResource,
  neutronAppMetadata,
  resourceCapabilities,
  systemAppMetadata,
} from "./resourcePolicy.ts";
import { createShortcut, shortcutMetadata } from "./shortcut.ts";

async function fresh() {
  const repository = new MemoryFsRepository();
  const raw = new PersistentFsService(repository);
  const root = await raw.resolvePath("/");
  const desktop = await raw.resolvePath("/Desktop");
  if (!root || !desktop) throw new Error("Fresh filesystem did not initialize expected roots");
  return { repository, raw, root, desktop };
}

function nativeApp(handlerId: HandlerId, name: string): NativeAppDefinition {
  return {
    id: handlerId,
    handlerId,
    name,
    icon: `system:${handlerId}`,
    singleton: false,
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

function element(id: string, name = id): ExternalElement {
  return {
    id,
    name,
    description: `${name} description`,
    version: 1,
    icon: `icon:${id}`,
    tiles: [{ id: "main", title: "Main" }],
    running: "no",
  };
}

test("bootstrap migrates legacy hidden metadata to dot names without hiding System", async () => {
  const { raw, desktop } = await fresh();
  const legacy = await raw.createFile(desktop.id, "secret.txt", { metadata: { hidden: true } });
  const systemBefore = await raw.resolvePath("/System");
  assert.equal(systemBefore?.metadata.hidden, true);

  const result = await bootstrapFilesystem(raw);
  assert.equal(result.hiddenRenamed, 1);
  assert.ok(result.hiddenCleared >= 2);
  assert.equal(await raw.pathOf(legacy.id), "/Desktop/.secret.txt");
  assert.equal((await raw.stat(legacy.id)).metadata.hidden, undefined);
  assert.equal((await raw.resolvePath("/System"))?.metadata.hidden, undefined);

  const managed = new ManagedFsService(raw);
  const visible = await managed.list(desktop.id);
  assert.equal(visible.some((node) => node.id === legacy.id), false);
  const withHidden = await managed.list(desktop.id, { includeHidden: true });
  assert.equal(withHidden.some((node) => node.id === legacy.id), true);
});

test("bootstrap is idempotent, moves Start Menu by NodeId, and creates only approved native sys resources", async () => {
  const { raw, root } = await fresh();
  const legacyStart = await raw.mkdir(root.id, "Start Menu");
  await raw.setMetadata(legacyStart.id, { "plasmon.shell.start.seeded.v1": ["native:native:settings"] });
  const apps = [
    nativeApp("native:explorer", "Files"),
    nativeApp("native:settings", "Settings"),
    nativeApp("native:properties", "Properties"),
    // Unknown native handlers are deliberately not promoted into .sys files.
    nativeApp("native:dos", "DOS"),
    nativeApp("native:emulator", "Emulator"),
  ];

  await bootstrapFilesystem(raw, { nativeApps: apps });
  const movedStart = await raw.resolvePath(START_MENU_PATH);
  assert.equal(movedStart?.id, legacyStart.id);
  assert.deepEqual(movedStart?.metadata["plasmon.shell.start.seeded.v1"], ["native:native:settings"]);

  const fileManager = await raw.resolvePath("/System/FileManager.sys");
  const settings = await raw.resolvePath("/System/Settings.sys");
  const properties = await raw.resolvePath("/System/.Properties.sys");
  assert.equal(fileManager?.mime, SYSTEM_APP_MIME);
  assert.equal(settings?.mime, SYSTEM_APP_MIME);
  assert.equal(properties?.mime, SYSTEM_APP_MIME);
  assert.equal(await raw.resolvePath("/System/DOS.sys"), null);
  assert.equal(await raw.resolvePath("/System/Emulator.sys"), null);
  assert.ok(await raw.resolvePath("/System/Program Files"));
  assert.equal(await raw.resolvePath("/System/Program Files/js-dos"), null);
  assert.equal(await raw.resolvePath("/System/Program Files/EmulatorJs"), null);

  const ids = [fileManager?.id, settings?.id, properties?.id];
  await bootstrapFilesystem(raw, { nativeApps: apps });
  assert.deepEqual([
    (await raw.resolvePath("/System/FileManager.sys"))?.id,
    (await raw.resolvePath("/System/Settings.sys"))?.id,
    (await raw.resolvePath("/System/.Properties.sys"))?.id,
  ], ids);
});

test("temporary demo seeds are idempotent, user deletion wins, and retirement does not delete survivors", async () => {
  const { raw } = await fresh();
  const demo: FilesystemSeedSpec = {
    key: "hackathon-2026.game.doom",
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: "doom.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
    bytes: new TextEncoder().encode("demo"),
  };

  await bootstrapFilesystem(raw, { demoSeeds: [demo] });
  const first = await raw.resolvePath("/Games/doom.jsdos");
  assert.ok(first);
  const root = await raw.resolvePath("/");
  assert.deepEqual(root?.metadata[DEMO_SEED_LEDGER_KEY], [demo.key]);

  // Retirement means the seed definition disappears; a surviving user copy is retained.
  await bootstrapFilesystem(raw, { demoSeeds: [] });
  assert.equal((await raw.resolvePath("/Games/doom.jsdos"))?.id, first.id);

  // If the user deletes it while the demo manifest still exists, it never fights back.
  await raw.remove(first.id);
  await bootstrapFilesystem(raw, { demoSeeds: [demo] });
  assert.equal(await raw.resolvePath("/Games/doom.jsdos"), null);
});

test("resource classification protects real sys/neutron metadata but not spoofed extensions", async () => {
  const now = Date.now();
  const base = {
    parentId: "parent",
    size: 0,
    createdAt: now,
    modifiedAt: now,
  } as const;
  const sys = {
    ...base,
    id: "sys",
    name: "Settings.sys",
    kind: "file" as const,
    mime: SYSTEM_APP_MIME,
    metadata: systemAppMetadata("native:settings", "native:settings"),
  };
  const neutron = {
    ...base,
    id: "neutron",
    name: "Mail.neutron",
    kind: "file" as const,
    mime: NEUTRON_APP_MIME,
    metadata: neutronAppMetadata({ elementId: "mail", name: "Mail" }),
  };
  const spoof = {
    ...base,
    id: "spoof",
    name: "notes.sys",
    kind: "file" as const,
    mime: "text/plain",
    metadata: {},
  };

  assert.equal(classifyResource(sys).kind, "system-app");
  assert.equal(resourceCapabilities(sys).delete, false);
  assert.equal(classifyResource(neutron).kind, "neutron-app");
  assert.equal(resourceCapabilities(neutron).delete, false);
  assert.equal(resourceCapabilities(neutron).uninstall, true);
  assert.equal(classifyResource(spoof).kind, "ordinary-file");
  assert.equal(resourceCapabilities(spoof).delete, true);
});

test("Neutron projections preserve NodeId while installed and public generic Delete is prohibited", async () => {
  const { raw } = await fresh();
  await bootstrapFilesystem(raw);
  const projections = new NeutronProjectionService(raw);
  await projections.reconcile([element("mail", "Mail")]);
  const first = await raw.resolvePath("/Apps/Mail.neutron");
  assert.ok(first);
  assert.equal(first.mime, NEUTRON_APP_MIME);

  await projections.reconcile([{ ...element("mail", "Mail"), version: 2, description: "Updated" }]);
  const updated = await raw.resolvePath("/Apps/Mail.neutron");
  assert.equal(updated?.id, first.id);

  const managed = new ProtectedManagedFsService(raw);
  await assert.rejects(() => managed.remove(first.id), /use Uninstall instead/u);
  assert.equal((await raw.resolvePath("/Apps/Mail.neutron"))?.id, first.id);

  await projections.reconcile([]);
  assert.equal(await raw.resolvePath("/Apps/Mail.neutron"), null);
});

test("Trash moves and restores the same NodeId and collision restore keeps both", async () => {
  const { raw, desktop } = await fresh();
  await bootstrapFilesystem(raw);
  const trash = new TrashService(raw);
  const original = await raw.createFile(desktop.id, "report.txt", { mime: "text/plain" });
  await raw.write(original.id, new TextEncoder().encode("old"), { truncate: true });

  const trashed = await trash.trash(original.id);
  assert.equal(trashed.node.id, original.id);
  assert.match(await raw.pathOf(original.id), /^\/System\/\.Trash\//u);
  assert.equal((await trash.list())[0]?.node.id, original.id);

  const replacement = await raw.createFile(desktop.id, "report.txt", { mime: "text/plain" });
  const restored = await trash.restore(original.id);
  assert.equal(restored.node.id, original.id);
  assert.equal(restored.renamed, true);
  assert.equal(restored.usedFallback, false);
  assert.notEqual(restored.node.name, replacement.name);
  assert.equal(restored.node.parentId, desktop.id);
  assert.equal((await trash.list()).length, 0);

  const again = await trash.trash(original.id);
  await trash.permanentlyDelete(again.node.id);
  await assert.rejects(() => raw.stat(original.id));
  assert.ok(await raw.resolvePath(TRASH_PATH));
});

class TestRegistry implements AssociationRegistry {
  readonly text: HandlerDefinition = {
    id: "native:text",
    kind: "native",
    name: "Text",
    icon: "text",
    capabilities: ["read"],
  };
  readonly jsdos: HandlerDefinition = {
    id: "runtime:js-dos",
    kind: "external",
    name: "js-dos",
    icon: "jsdos",
    capabilities: ["read"],
  };
  private handlers = new Map<HandlerId, HandlerDefinition>([
    [this.text.id, this.text],
    [this.jsdos.id, this.jsdos],
  ]);

  registerHandler(handler: HandlerDefinition): void { this.handlers.set(handler.id, handler); }
  registerRule(_rule: AssociationRule): void {}
  getHandler(id: HandlerId): HandlerDefinition | null { return this.handlers.get(id) ?? null; }
  async resolve(node: { name: string }): Promise<HandlerDefinition[]> {
    return node.name.toLowerCase().endsWith(".jsdos") ? [this.jsdos] : [this.text];
  }
  async getDefault(node: { name: string }): Promise<HandlerDefinition | null> { return (await this.resolve(node))[0] ?? null; }
  async setUserDefault(): Promise<void> {}
}

class TestOpenService implements OpenService {
  readonly calls: Array<{ handlerId: HandlerId; target: OpenTarget }> = [];
  async open(handlerId: HandlerId, target: OpenTarget): Promise<void> { this.calls.push({ handlerId, target }); }
}

class TestProcess implements ProcessController {
  readonly calls: Array<{ handlerId: HandlerId; target: OpenTarget }> = [];
  async open(handlerId: HandlerId, target: OpenTarget): Promise<ProcessId | null> {
    this.calls.push({ handlerId, target });
    return `process-${this.calls.length}`;
  }
  focus(): void {}
  close(): void {}
  setTitle(): void {}
  setTarget(): void {}
  list(): readonly ProcessRecord[] { return []; }
  subscribe(): () => void { return () => undefined; }
}

class TestNeutron implements NeutronBridge {
  readonly opened: string[] = [];
  async loadElements(): Promise<ExternalElement[]> { return []; }
  async openElement(appId: string): Promise<void> { this.opened.push(appId); }
  async offerInstall(): Promise<void> {}
  async refreshRuntimeState(): Promise<void> {}
  subscribe(): () => void { return () => undefined; }
}

test("shared dispatcher dereferences node shortcuts and keeps game launching association-driven", async () => {
  const { raw, desktop } = await fresh();
  await bootstrapFilesystem(raw, { nativeApps: [nativeApp("native:settings", "Settings")] });
  const managed = new ManagedFsService(raw);
  const registry = new TestRegistry();
  const openService = new TestOpenService();
  const process = new TestProcess();
  const neutron = new TestNeutron();
  const dispatcher = new FilesystemOpenDispatcher({ fs: managed, associations: registry, openService, process, neutron });

  const game = await raw.createFile(desktop.id, "doom.jsdos", { mime: "application/x-jsdos" });
  const gameShortcut = await createShortcut(raw, desktop.id, { kind: "node", nodeId: game.id }, { name: "Doom" });
  await dispatcher.openNode(gameShortcut.id);
  assert.equal(openService.calls.at(-1)?.handlerId, "runtime:js-dos");
  assert.equal(openService.calls.at(-1)?.target.nodeId, game.id);

  // A different filename with the same file type takes exactly the same path.
  const otherGame = await raw.createFile(desktop.id, "anything.jsdos", { mime: "application/x-jsdos" });
  await dispatcher.openNode(otherGame.id);
  assert.equal(openService.calls.at(-1)?.handlerId, "runtime:js-dos");
  assert.equal(openService.calls.at(-1)?.target.nodeId, otherGame.id);

  const settings = await raw.resolvePath("/System/Settings.sys");
  assert.ok(settings);
  await dispatcher.openNode(settings.id);
  assert.equal(openService.calls.at(-1)?.handlerId, "native:settings");

  const projections = new NeutronProjectionService(raw);
  await projections.reconcile([element("mail", "Mail")]);
  const mail = await raw.resolvePath("/Apps/Mail.neutron");
  assert.ok(mail);
  await dispatcher.openNode(mail.id);
  assert.deepEqual(neutron.opened, ["mail"]);

  const folderShortcut = await createShortcut(raw, desktop.id, { kind: "node", nodeId: desktop.id }, { name: "Desktop Folder" });
  await dispatcher.openNode(folderShortcut.id);
  assert.equal(process.calls.at(-1)?.handlerId, "native:explorer");
  assert.equal(process.calls.at(-1)?.target.nodeId, desktop.id);
});

test("shared dispatcher rejects shortcut loops and targets in Recycle Bin", async () => {
  const { raw, desktop } = await fresh();
  await bootstrapFilesystem(raw);
  const managed = new ManagedFsService(raw);
  const dispatcher = new FilesystemOpenDispatcher({
    fs: managed,
    associations: new TestRegistry(),
    openService: new TestOpenService(),
    process: new TestProcess(),
    neutron: new TestNeutron(),
  });

  const first = await raw.createFile(desktop.id, "First", { kind: "shortcut", metadata: shortcutMetadata({ kind: "node", nodeId: "placeholder" }) });
  const second = await raw.createFile(desktop.id, "Second", { kind: "shortcut", metadata: shortcutMetadata({ kind: "node", nodeId: first.id }) });
  await raw.setMetadata(first.id, { "plasmon.shortcut": shortcutMetadata({ kind: "node", nodeId: second.id })["plasmon.shortcut"] ?? null });
  await assert.rejects(() => dispatcher.openNode(first.id), /loop/u);

  const file = await raw.createFile(desktop.id, "deleted.txt");
  const shortcut = await createShortcut(raw, desktop.id, { kind: "node", nodeId: file.id }, { name: "Deleted" });
  await new TrashService(raw).trash(file.id);
  await assert.rejects(() => dispatcher.openNode(shortcut.id), /Recycle Bin/u);
});
