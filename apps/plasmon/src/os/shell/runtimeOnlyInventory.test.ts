import { expect, test } from "bun:test";
import type { FsNode, NativeAppDefinition } from "../contracts/index.ts";
import { MemoryFsRepository } from "../fs/index.ts";
import { createShortcut } from "../fs/shortcut.ts";
import { createPlasmonServices } from "../integration/services.ts";
import {
  START_MENU_PATH,
  parseStartShortcut,
  reconcileStartMenu,
  searchApplicationEntries,
} from "./index.ts";

type Services = ReturnType<typeof createPlasmonServices>;

const JS_DOS_HANDLER = "runtime:js-dos";
const JS_DOS_DEFAULT_PATH = `${START_MENU_PATH}/Accessories/js-dos`;

async function nativeShortcuts(services: Services, rootId: string): Promise<FsNode[]> {
  const nodes: FsNode[] = [];
  const queue = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const directoryId = queue.shift();
    if (!directoryId || visited.has(directoryId)) continue;
    visited.add(directoryId);

    for (const node of await services.fs.list(directoryId, { includeHidden: true, sort: "name" })) {
      if (node.kind === "directory") {
        queue.push(node.id);
        continue;
      }
      if (parseStartShortcut(node)?.target.kind === "native") nodes.push(node);
    }
  }

  return nodes;
}

async function nativeShortcutForHandler(
  services: Services,
  rootId: string,
  handlerId: string,
): Promise<FsNode | null> {
  for (const node of await nativeShortcuts(services, rootId)) {
    const shortcut = parseStartShortcut(node);
    if (shortcut?.target.kind === "native" && shortcut.target.handlerId === handlerId) return node;
  }
  return null;
}

function priorReleaseDefinitions(services: Services): NativeAppDefinition[] {
  return services.nativeApps.list().map((app) => app.handlerId === JS_DOS_HANDLER
    ? { ...app, runtimeOnly: undefined }
    : app);
}

async function seedPriorManagedJsDos(
  repository: MemoryFsRepository,
  customize?: (services: Services, node: FsNode) => Promise<void>,
): Promise<{ nodeId: string }> {
  const services = createPlasmonServices({ filesystemRepository: repository });
  try {
    await services.filesystem.ready;
    const { root } = await reconcileStartMenu(services.fs, priorReleaseDefinitions(services), []);
    const node = await nativeShortcutForHandler(services, root.id, JS_DOS_HANDLER);
    if (!node) throw new Error("Prior managed js-dos Start seed was not created");
    expect(await services.fs.pathOf(node.id)).toBe(JS_DOS_DEFAULT_PATH);
    if (customize) await customize(services, node);
    return { nodeId: node.id };
  } finally {
    services.filesystem.dispose();
  }
}

async function assertJsDosAssociationLaunches(services: Services, name: string): Promise<void> {
  const documents = await services.fs.resolvePath("/Documents");
  expect(documents?.kind).toBe("directory");
  if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

  const bundle = await services.fs.createFile(documents.id, name, {
    mime: "application/x-jsdos",
  });
  const candidates = await services.associations.resolve(bundle);
  expect(candidates.map(({ id }) => id)).toContain(JS_DOS_HANDLER);

  await services.openService.open(JS_DOS_HANDLER, { nodeId: bundle.id });
  expect(services.process.list().some((record) => record.handlerId === JS_DOS_HANDLER)).toBe(true);
  for (const record of services.process.list()) services.process.close(record.id);
}

test("runtime-only process host is not a user-launchable Shell application", async () => {
  const services = createPlasmonServices({ filesystemRepository: new MemoryFsRepository() });

  try {
    await services.filesystem.ready;

    const runtime = services.nativeApps.getByHandler(JS_DOS_HANDLER);
    expect(runtime).not.toBeNull();
    expect(runtime?.runtimeOnly).toBe(true);
    expect(runtime && services.nativeApps.hasLoader(runtime.id)).toBe(true);

    await assertJsDosAssociationLaunches(services, "Runtime Host Gate.jsdos");

    const applicationResults = searchApplicationEntries(services.nativeApps.list(), [], "");
    expect(applicationResults.some(
      (result) => result.kind === "native-app" && result.app.handlerId === JS_DOS_HANDLER,
    )).toBe(false);
    expect(applicationResults.some(
      (result) => result.kind === "native-app" && result.app.handlerId === "native:settings",
    )).toBe(true);

    const { root } = await reconcileStartMenu(services.fs, services.nativeApps.list(), []);
    expect(await nativeShortcutForHandler(services, root.id, JS_DOS_HANDLER)).toBeNull();
    expect(await nativeShortcutForHandler(services, root.id, "native:settings")).not.toBeNull();
  } finally {
    services.filesystem.dispose();
  }
});

test("upgrade retires the exact prior managed js-dos Start seed and remains idempotent", async () => {
  const repository = new MemoryFsRepository();
  const legacy = await seedPriorManagedJsDos(repository);
  const services = createPlasmonServices({ filesystemRepository: repository });

  try {
    await services.filesystem.ready;
    const first = await reconcileStartMenu(services.fs, services.nativeApps.list(), []);

    expect(await services.fs.resolvePath(JS_DOS_DEFAULT_PATH)).toBeNull();
    expect(await nativeShortcutForHandler(services, first.root.id, JS_DOS_HANDLER)).toBeNull();
    expect(await services.fs.stat(legacy.nodeId).then(() => true, () => false)).toBe(false);

    const revisionAfterRetirement = await services.fs.revision();
    const second = await reconcileStartMenu(services.fs, services.nativeApps.list(), []);
    expect(await services.fs.revision()).toBe(revisionAfterRetirement);
    expect(second.created).toBe(0);
    expect(await nativeShortcutForHandler(services, second.root.id, JS_DOS_HANDLER)).toBeNull();

    await assertJsDosAssociationLaunches(services, "Upgrade Runtime Gate.jsdos");
  } finally {
    services.filesystem.dispose();
  }
});

test("upgrade preserves renamed moved and metadata-customized prior js-dos Start entries", async () => {
  const renamedRepository = new MemoryFsRepository();
  const renamed = await seedPriorManagedJsDos(renamedRepository, async (services, node) => {
    await services.fs.rename(node.id, "My DOS Runtime");
  });
  const renamedServices = createPlasmonServices({ filesystemRepository: renamedRepository });
  try {
    await renamedServices.filesystem.ready;
    await reconcileStartMenu(renamedServices.fs, renamedServices.nativeApps.list(), []);
    expect((await renamedServices.fs.stat(renamed.nodeId)).name).toBe("My DOS Runtime");
    expect(await renamedServices.fs.pathOf(renamed.nodeId)).toBe(`${START_MENU_PATH}/Accessories/My DOS Runtime`);
  } finally {
    renamedServices.filesystem.dispose();
  }

  const movedRepository = new MemoryFsRepository();
  const moved = await seedPriorManagedJsDos(movedRepository, async (services, node) => {
    const root = await services.fs.resolvePath(START_MENU_PATH);
    if (!root || root.kind !== "directory") throw new Error("Start Menu root is unavailable");
    const custom = await services.fs.mkdir(root.id, "My Runtimes");
    await services.fs.move(node.id, custom.id);
  });
  const movedServices = createPlasmonServices({ filesystemRepository: movedRepository });
  try {
    await movedServices.filesystem.ready;
    await reconcileStartMenu(movedServices.fs, movedServices.nativeApps.list(), []);
    expect(await movedServices.fs.pathOf(moved.nodeId)).toBe(`${START_MENU_PATH}/My Runtimes/js-dos`);
  } finally {
    movedServices.filesystem.dispose();
  }

  const metadataRepository = new MemoryFsRepository();
  const metadata = await seedPriorManagedJsDos(metadataRepository, async (services, node) => {
    await services.fs.setMetadata(node.id, { "user.runtime-note": "keep" });
  });
  const metadataServices = createPlasmonServices({ filesystemRepository: metadataRepository });
  try {
    await metadataServices.filesystem.ready;
    await reconcileStartMenu(metadataServices.fs, metadataServices.nativeApps.list(), []);
    expect((await metadataServices.fs.stat(metadata.nodeId)).metadata["user.runtime-note"]).toBe("keep");
    expect(await metadataServices.fs.pathOf(metadata.nodeId)).toBe(JS_DOS_DEFAULT_PATH);
  } finally {
    metadataServices.filesystem.dispose();
  }
});

test("runtime-only reconciliation preserves prior deletion and an exact user-created js-dos shortcut", async () => {
  const deletedRepository = new MemoryFsRepository();
  await seedPriorManagedJsDos(deletedRepository, async (services, node) => {
    await services.fs.remove(node.id);
  });
  const deletedServices = createPlasmonServices({ filesystemRepository: deletedRepository });
  try {
    await deletedServices.filesystem.ready;
    const { root } = await reconcileStartMenu(deletedServices.fs, deletedServices.nativeApps.list(), []);
    expect(await nativeShortcutForHandler(deletedServices, root.id, JS_DOS_HANDLER)).toBeNull();
    const revisionAfterFirst = await deletedServices.fs.revision();
    await reconcileStartMenu(deletedServices.fs, deletedServices.nativeApps.list(), []);
    expect(await deletedServices.fs.revision()).toBe(revisionAfterFirst);
  } finally {
    deletedServices.filesystem.dispose();
  }

  const userRepository = new MemoryFsRepository();
  const userServices = createPlasmonServices({ filesystemRepository: userRepository });
  try {
    await userServices.filesystem.ready;
    const { root } = await reconcileStartMenu(userServices.fs, userServices.nativeApps.list(), []);
    const accessories = await userServices.fs.resolvePath(`${START_MENU_PATH}/Accessories`);
    expect(accessories?.kind).toBe("directory");
    if (!accessories || accessories.kind !== "directory") throw new Error("Accessories folder is unavailable");

    const userShortcut = await createShortcut(
      userServices.fs,
      accessories.id,
      { kind: "native", handlerId: JS_DOS_HANDLER },
      { name: "js-dos" },
    );
    await reconcileStartMenu(userServices.fs, userServices.nativeApps.list(), []);

    expect((await userServices.fs.stat(userShortcut.id)).id).toBe(userShortcut.id);
    expect(await userServices.fs.pathOf(userShortcut.id)).toBe(JS_DOS_DEFAULT_PATH);
    expect(await nativeShortcutForHandler(userServices, root.id, JS_DOS_HANDLER)).not.toBeNull();
  } finally {
    userServices.filesystem.dispose();
  }
});
