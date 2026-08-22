import { expect, test } from "bun:test";
import { MemoryFsRepository, readSharedShortcut } from "../os/fs/index.ts";
import { createPlasmonServices } from "../os/integration/services.ts";
import { MockNeutronBridge } from "../os/neutron/index.ts";
import { searchFilesystem } from "../os/shell/search.ts";
import { NativeWindowManager } from "../os/windowing/index.ts";
import {
  DEMO_IMAGE_PATH,
  DEMO_MARKDOWN_PATH,
  DEMO_TEXT_PATH,
  createDemoSeeds,
  reconcileDemoDesktopShortcuts,
} from "./demoContent.ts";

function deterministicWindows(): NativeWindowManager {
  let nextWindowId = 0;
  return new NativeWindowManager({
    idFactory: () => `window:demo:${++nextWindowId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
}

test("ordinary production composition remains free of demo resources", async () => {
  const windows = deterministicWindows();
  const services = createPlasmonServices({
    filesystemRepository: new MemoryFsRepository(),
    neutron: new MockNeutronBridge({ elements: [] }),
    windows,
  });
  try {
    await services.filesystem.ready;
    expect(await services.fs.resolvePath(DEMO_TEXT_PATH)).toBeNull();
    expect(await services.fs.resolvePath(DEMO_MARKDOWN_PATH)).toBeNull();
    expect(await services.fs.resolvePath(DEMO_IMAGE_PATH)).toBeNull();
    const desktop = await services.fs.resolvePath("/Desktop");
    if (!desktop) throw new Error("Desktop missing");
    const desktopNames = (await services.fs.list(desktop.id)).map(({ name }) => name);
    expect(desktopNames).not.toContain("Demo Notes.txt");
    expect(desktopNames).not.toContain("Demo Guide.md");
    expect(desktopNames).not.toContain("Demo Artwork.svg");
  } finally {
    services.filesystem.dispose();
    windows.dispose();
  }
});

test("demo profile seeds authored redistribution-safe document and image resources", () => {
  const seeds = createDemoSeeds();
  expect(seeds).toHaveLength(5);
  expect(seeds.map(({ key }) => key)).toEqual([
    "demo.documents-directory.v1",
    "demo.pictures-directory.v1",
    "demo.notes.v1",
    "demo.guide.v1",
    "demo.artwork.v1",
  ]);
  expect(seeds.some((seed) => seed.parentPath === "/Games")).toBe(false);

  const byName = new Map(seeds.map((seed) => [seed.name, seed] as const));
  expect(byName.get("Demo Notes.txt")).toMatchObject({ seedClass: "demo-temporary", parentPath: "/Documents", kind: "file", mime: "text/plain" });
  expect(byName.get("Demo Guide.md")).toMatchObject({ seedClass: "demo-temporary", parentPath: "/Documents", kind: "file", mime: "text/markdown" });
  expect(byName.get("Demo Artwork.svg")).toMatchObject({ seedClass: "demo-temporary", parentPath: "/Pictures", kind: "file", mime: "image/svg+xml" });

  const decoder = new TextDecoder();
  expect(decoder.decode(byName.get("Demo Notes.txt")?.bytes)).toContain("authored for the Plasmon demo environment");
  expect(decoder.decode(byName.get("Demo Guide.md")?.bytes)).toContain("redistribution-safe Markdown demo document");
  expect(decoder.decode(byName.get("Demo Artwork.svg")?.bytes)).toContain("Plasmon Demo");
});

test("demo resources and Desktop shortcuts traverse production bootstrap and opening", async () => {
  const windows = deterministicWindows();
  const services = createPlasmonServices({
    filesystemRepository: new MemoryFsRepository(),
    neutron: new MockNeutronBridge({ elements: [] }),
    windows,
    demoSeeds: createDemoSeeds(),
  });

  try {
    await services.filesystem.ready;
    await reconcileDemoDesktopShortcuts(services.fs);
    await reconcileDemoDesktopShortcuts(services.fs);

    const expected = [
      { path: DEMO_TEXT_PATH, name: "Demo Notes.txt", mime: "text/plain", handler: "native:text", category: "documents" },
      { path: DEMO_MARKDOWN_PATH, name: "Demo Guide.md", mime: "text/markdown", handler: "native:markdown", category: "documents" },
      { path: DEMO_IMAGE_PATH, name: "Demo Artwork.svg", mime: "image/svg+xml", handler: "native:photos", category: "media" },
    ] as const;

    const search = await searchFilesystem(services.fs, "Demo");
    expect(search.warnings).toEqual([]);
    expect(search.truncated).toBe(false);
    const searchFiles = search.results.filter((result) => result.kind === "file");

    const desktop = await services.fs.resolvePath("/Desktop");
    if (!desktop) throw new Error("Desktop missing");
    const desktopEntries = await services.fs.list(desktop.id, { sort: "name" });
    const demoShortcuts = desktopEntries.filter((entry) => expected.some(({ name }) => name === entry.name));
    expect(demoShortcuts).toHaveLength(3);

    for (const item of expected) {
      const node = await services.fs.resolvePath(item.path);
      expect(node).toMatchObject({ name: item.name, kind: "file", mime: item.mime });
      if (!node) throw new Error(`Missing demo resource ${item.path}`);

      const result = searchFiles.find((entry) => entry.node.id === node.id);
      expect(result).toMatchObject({ title: item.name, category: item.category });
      const handlers = (await services.associations.resolve(node)).map(({ id }) => id);
      expect(handlers[0]).toBe(item.handler);

      const shortcut = demoShortcuts.find((entry) => entry.name === item.name);
      if (!shortcut) throw new Error(`Missing Desktop shortcut for ${item.path}`);
      expect(readSharedShortcut(shortcut)).toEqual({ format: "plasmon.shortcut", version: 1, target: { kind: "node", nodeId: node.id } });

      await services.filesystem.open.openNode(shortcut.id);
      const process = services.process.list().find((candidate) => candidate.target.nodeId === node.id);
      expect(process).toMatchObject({ handlerId: item.handler, target: { nodeId: node.id } });
      if (!process) throw new Error(`No process opened for ${item.path}`);
      expect(process.windowId).not.toBeNull();
      services.process.close(process.id);
    }
  } finally {
    for (const process of services.process.list()) services.process.close(process.id);
    services.filesystem.dispose();
    windows.dispose();
  }
});
