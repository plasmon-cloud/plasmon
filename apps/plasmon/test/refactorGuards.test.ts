import { describe, expect, test } from "bun:test";
import type { ExternalElement, FsNode } from "../src/os/contracts/index.ts";
import {
  MemoryFsRepository,
  createShortcut,
  readNeutronAppMetadata,
} from "../src/os/fs/index.ts";
import { EMULATORJS_NES_MIME } from "../src/native-apps/emulatorjs/runtime.ts";
import { parseStartShortcut, searchShell, type StartShortcut } from "../src/os/shell/index.ts";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "./headlessEnvironment.ts";

const reviewElement: ExternalElement = {
  id: "review",
  name: "Review",
  description: "Collaborative review workspace.",
  version: 1,
  icon: "/app/review/icon.svg",
  tiles: [{ id: "review", title: "Review" }],
  running: "no",
};

function requireDirectory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

function requireNode(node: FsNode | null, path: string): FsNode {
  if (!node) throw new Error(`${path} is unavailable`);
  return node;
}

async function expectSingleNamedChild(
  environment: HeadlessPlasmonEnvironment,
  parent: FsNode,
  name: string,
): Promise<FsNode> {
  const matches = (await environment.services.fs.list(parent.id, { includeHidden: true }))
    .filter((node) => node.name === name);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

async function collectStartShortcuts(
  environment: HeadlessPlasmonEnvironment,
): Promise<StartShortcut[]> {
  const root = requireDirectory(
    await environment.node("/System/Start Menu"),
    "/System/Start Menu",
  );
  const queue = [root];
  const visited = new Set<string>();
  const shortcuts: StartShortcut[] = [];

  while (queue.length > 0) {
    const directory = queue.shift();
    if (!directory || visited.has(directory.id)) continue;
    visited.add(directory.id);
    for (const child of await environment.services.fs.list(directory.id, { includeHidden: true })) {
      if (child.kind === "directory") {
        queue.push(child);
        continue;
      }
      const shortcut = parseStartShortcut(child);
      if (shortcut) shortcuts.push(shortcut);
    }
  }
  return shortcuts;
}

function emulatorFixture(): Uint8Array {
  const bytes = new Uint8Array(16 + 16_384);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x00], 0);
  return bytes;
}

describe("Plasmon refactor guards", () => {
  test("assembled production composition boots one canonical set of core authorities", async () => {
    const environment = createHeadlessPlasmonEnvironment({
      // Duplicate discovery is intentional: assembled boot must still expose one
      // filesystem projection for the Kernel-owned application identity.
      elements: [reviewElement, reviewElement],
    });

    try {
      const ready = await environment.ready;
      expect(ready.neutronProjectionError).toBeNull();

      const root = requireDirectory(await environment.node("/"), "/");
      const desktop = requireDirectory(await environment.node("/Desktop"), "/Desktop");
      const system = requireDirectory(await environment.node("/System"), "/System");
      const apps = requireDirectory(await environment.node("/Apps"), "/Apps");
      const startMenu = requireDirectory(
        await environment.node("/System/Start Menu"),
        "/System/Start Menu",
      );

      expect(desktop.parentId).toBe(root.id);
      expect(system.parentId).toBe(root.id);
      expect(apps.parentId).toBe(root.id);
      expect(startMenu.parentId).toBe(system.id);

      await expectSingleNamedChild(environment, root, "Desktop");
      await expectSingleNamedChild(environment, root, "System");
      await expectSingleNamedChild(environment, root, "Apps");
      await expectSingleNamedChild(environment, system, "Start Menu");

      const settings = await expectSingleNamedChild(environment, system, "Settings.sys");
      expect(settings.kind).toBe("file");
      expect(environment.services.nativeApps.list().filter((app) => app.id === "native:settings"))
        .toHaveLength(1);

      const review = requireNode(
        await environment.node("/Apps/Review.neutron"),
        "/Apps/Review.neutron",
      );
      const reviewProjections = (await environment.services.fs.list(apps.id, { includeHidden: true }))
        .filter((node) => readNeutronAppMetadata(node)?.elementId === reviewElement.id);
      expect(reviewProjections).toHaveLength(1);
      expect(reviewProjections[0]?.id).toBe(review.id);
    } finally {
      environment.dispose();
    }
  });

  test("canonical filesystem opening reaches native, Markdown, runtime, and Neutron owners without changing resource identity", async () => {
    const environment = createHeadlessPlasmonEnvironment({ elements: [reviewElement] });

    try {
      await environment.ready;
      const documents = requireDirectory(await environment.node("/Documents"), "/Documents");

      const text = await environment.services.fs.createFile(documents.id, "Refactor Guard.txt", {
        mime: "text/plain",
      });
      const markdown = await environment.services.fs.createFile(documents.id, "Refactor Guard.md", {
        mime: "text/markdown",
      });
      const rom = await environment.services.fs.createFile(documents.id, "Refactor Guard.nes", {
        mime: EMULATORJS_NES_MIME,
      });
      await environment.services.fs.write(rom.id, emulatorFixture(), { truncate: true });

      const nativeCases = [
        { node: text, path: "/Documents/Refactor Guard.txt", handlerId: "native:text" },
        { node: markdown, path: "/Documents/Refactor Guard.md", handlerId: "native:markdown" },
        { node: rom, path: "/Documents/Refactor Guard.nes", handlerId: "runtime:emulatorjs" },
      ] as const;

      for (const candidate of nativeCases) {
        expect((await environment.services.associations.resolve(candidate.node))[0]?.id)
          .toBe(candidate.handlerId);
        expect(environment.processes()).toHaveLength(0);
        expect(environment.windows()).toHaveLength(0);

        await environment.open(candidate.path);

        const processes = environment.processes();
        const windows = environment.windows();
        expect(processes).toHaveLength(1);
        expect(windows).toHaveLength(1);
        expect(processes[0]).toMatchObject({
          handlerId: candidate.handlerId,
          target: expect.objectContaining({ nodeId: candidate.node.id }),
        });
        expect(windows[0]?.processId).toBe(processes[0]?.id);
        expect((await environment.node(candidate.path))?.id).toBe(candidate.node.id);

        environment.services.process.close(processes[0]!.id);
        expect(environment.processes()).toHaveLength(0);
        expect(environment.windows()).toHaveLength(0);
      }

      const review = requireNode(
        await environment.node("/Apps/Review.neutron"),
        "/Apps/Review.neutron",
      );
      const beforeMessages = environment.neutronMessages.length;
      await environment.open("/Apps/Review.neutron");
      expect(environment.neutronMessages.slice(beforeMessages)).toEqual([
        "[Plasmon preview] Open Review/review",
      ]);
      expect((await environment.node("/Apps/Review.neutron"))?.id).toBe(review.id);
      expect(environment.processes()).toHaveLength(0);
      expect(environment.windows()).toHaveLength(0);
    } finally {
      environment.dispose();
    }
  });

  test("two native document activations remain independent Process and Window instances", async () => {
    const environment = createHeadlessPlasmonEnvironment();
    try {
      await environment.ready;
      const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
      const first = await environment.services.fs.createFile(documents.id, "Window One.txt", {
        mime: "text/plain",
      });
      const second = await environment.services.fs.createFile(documents.id, "Window Two.txt", {
        mime: "text/plain",
      });

      await environment.open("/Documents/Window One.txt");
      await environment.open("/Documents/Window Two.txt");

      const processes = environment.processes();
      const windows = environment.windows();
      expect(processes).toHaveLength(2);
      expect(windows).toHaveLength(2);
      expect(new Set(processes.map((process) => process.id)).size).toBe(2);
      expect(new Set(windows.map((window) => window.id)).size).toBe(2);
      expect(new Set(processes.map((process) => process.target.nodeId)))
        .toEqual(new Set([first.id, second.id]));
      expect(new Set(windows.map((window) => window.processId)))
        .toEqual(new Set(processes.map((process) => process.id)));

      environment.services.process.close(processes[0]!.id);
      expect(environment.processes()).toHaveLength(1);
      expect(environment.windows()).toHaveLength(1);
      expect(environment.windows()[0]?.processId).toBe(environment.processes()[0]?.id);
    } finally {
      environment.dispose();
    }
  });

  test("Start and Search project native, Neutron, and ordinary filesystem authorities instead of parallel catalogs", async () => {
    const environment = createHeadlessPlasmonEnvironment({ elements: [reviewElement] });
    try {
      await environment.ready;
      const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
      const startMenu = requireDirectory(
        await environment.node("/System/Start Menu"),
        "/System/Start Menu",
      );
      const settingsDefinition = environment.services.nativeApps.list()
        .find((app) => app.id === "native:settings");
      if (!settingsDefinition) throw new Error("Settings native definition is unavailable");

      const document = await environment.services.fs.createFile(documents.id, "Projection Note.txt", {
        mime: "text/plain",
      });
      await createShortcut(
        environment.services.fs,
        startMenu.id,
        { kind: "node", nodeId: document.id },
        { name: "Projection Note" },
      );

      const startShortcuts = await collectStartShortcuts(environment);
      expect(startShortcuts.filter(
        ({ target }) => target.kind === "native" && target.handlerId === settingsDefinition.handlerId,
      )).toHaveLength(1);
      expect(startShortcuts.filter(
        ({ target }) => target.kind === "element" && target.elementId === reviewElement.id,
      )).toHaveLength(1);
      expect(startShortcuts.filter(
        ({ target }) => target.kind === "node" && target.nodeId === document.id,
      )).toHaveLength(1);

      const nativeSearch = await searchShell(
        environment.services.fs,
        environment.services.nativeApps.list(),
        [reviewElement],
        "Settings",
      );
      expect(nativeSearch.results.filter(
        (result) => result.kind === "native-app" && result.app.id === settingsDefinition.id,
      )).toHaveLength(1);

      const reviewProjection = requireNode(
        await environment.node("/Apps/Review.neutron"),
        "/Apps/Review.neutron",
      );
      const reviewSearch = await searchShell(
        environment.services.fs,
        environment.services.nativeApps.list(),
        [reviewElement],
        "Review",
      );
      expect(reviewSearch.results.filter(
        (result) => result.kind === "neutron-projection"
          && result.elementId === reviewElement.id
          && result.node.id === reviewProjection.id,
      )).toHaveLength(1);
      expect(reviewSearch.results.filter((result) => result.kind === "element")).toHaveLength(0);

      const documentSearch = await searchShell(
        environment.services.fs,
        environment.services.nativeApps.list(),
        [reviewElement],
        "Projection Note",
      );
      expect(documentSearch.results.filter(
        (result) => result.kind === "file" && result.node.id === document.id,
      )).toHaveLength(1);
      expect(documentSearch.results.filter(
        (result) => result.kind === "start-shortcut"
          && result.target.kind === "node"
          && result.target.nodeId === document.id,
      )).toHaveLength(1);
    } finally {
      environment.dispose();
    }
  });

  test("stable NodeId survives rename, move, open, Trash, restore, shortcut activation, and production recomposition", async () => {
    const repository = new MemoryFsRepository();
    const first = createHeadlessPlasmonEnvironment({ repository, elements: [reviewElement] });

    let resourceId = "";
    let shortcutId = "";
    let settingsId = "";
    let reviewProjectionId = "";

    try {
      await first.ready;
      const desktop = requireDirectory(await first.node("/Desktop"), "/Desktop");
      const documents = requireDirectory(await first.node("/Documents"), "/Documents");

      const resource = await first.services.fs.createFile(desktop.id, "Lifecycle Draft.txt", {
        mime: "text/plain",
      });
      resourceId = resource.id;
      await first.services.fs.write(
        resource.id,
        new TextEncoder().encode("refactor guard state"),
        { truncate: true },
      );

      expect((await first.services.fs.rename(resource.id, "Lifecycle Final.txt")).id).toBe(resource.id);
      expect((await first.services.fs.move(resource.id, documents.id)).id).toBe(resource.id);
      expect(await first.services.fs.pathOf(resource.id)).toBe("/Documents/Lifecycle Final.txt");

      await first.open("/Documents/Lifecycle Final.txt");
      expect(first.processes()).toHaveLength(1);
      expect(first.processes()[0]).toMatchObject({
        handlerId: "native:text",
        target: expect.objectContaining({ nodeId: resource.id }),
      });
      first.services.process.close(first.processes()[0]!.id);

      const trashed = await first.services.filesystem.trash.trash(resource.id);
      expect(trashed.node.id).toBe(resource.id);
      expect(await first.node("/Documents/Lifecycle Final.txt")).toBeNull();
      expect((await first.services.filesystem.trash.list()).map((entry) => entry.node.id))
        .toContain(resource.id);

      const restored = await first.services.filesystem.trash.restore(resource.id);
      expect(restored.node.id).toBe(resource.id);
      expect((await first.node("/Documents/Lifecycle Final.txt"))?.id).toBe(resource.id);

      const shortcut = await createShortcut(
        first.services.fs,
        desktop.id,
        { kind: "node", nodeId: resource.id },
        { name: "Lifecycle Shortcut" },
      );
      shortcutId = shortcut.id;

      await first.open("/Desktop/Lifecycle Shortcut");
      expect(first.processes()).toHaveLength(1);
      expect(first.processes()[0]).toMatchObject({
        handlerId: "native:text",
        target: expect.objectContaining({ nodeId: resource.id }),
      });
      first.services.process.close(first.processes()[0]!.id);

      settingsId = requireNode(await first.node("/System/Settings.sys"), "/System/Settings.sys").id;
      reviewProjectionId = requireNode(
        await first.node("/Apps/Review.neutron"),
        "/Apps/Review.neutron",
      ).id;
    } finally {
      first.dispose();
    }

    const second = createHeadlessPlasmonEnvironment({ repository, elements: [reviewElement] });
    try {
      const ready = await second.ready;
      expect(ready.neutronProjectionError).toBeNull();

      const resource = requireNode(
        await second.node("/Documents/Lifecycle Final.txt"),
        "/Documents/Lifecycle Final.txt",
      );
      expect(resource.id).toBe(resourceId);
      expect(new TextDecoder().decode(await second.services.fs.read(resource.id)))
        .toBe("refactor guard state");
      expect((await second.node("/Desktop/Lifecycle Shortcut"))?.id).toBe(shortcutId);
      expect((await second.node("/System/Settings.sys"))?.id).toBe(settingsId);
      expect((await second.node("/Apps/Review.neutron"))?.id).toBe(reviewProjectionId);

      const apps = requireDirectory(await second.node("/Apps"), "/Apps");
      const reviewProjections = (await second.services.fs.list(apps.id, { includeHidden: true }))
        .filter((node) => readNeutronAppMetadata(node)?.elementId === reviewElement.id);
      expect(reviewProjections).toHaveLength(1);

      await second.open("/Desktop/Lifecycle Shortcut");
      expect(second.processes()).toHaveLength(1);
      expect(second.processes()[0]).toMatchObject({
        handlerId: "native:text",
        target: expect.objectContaining({ nodeId: resourceId }),
      });
    } finally {
      second.dispose();
    }
  });
});
