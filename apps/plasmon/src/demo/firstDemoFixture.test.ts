import { expect, test } from "bun:test";
import { MemoryFsRepository } from "../os/fs/index.ts";
import { createPlasmonServices } from "../os/integration/services.ts";
import { MockNeutronBridge } from "../os/neutron/index.ts";
import { searchFilesystem } from "../os/shell/search.ts";
import { NativeWindowManager } from "../os/windowing/index.ts";
import {
  FIRST_DEMO_IMAGE_PATH,
  FIRST_DEMO_MARKDOWN_PATH,
  FIRST_DEMO_TEXT_PATH,
  createFirstDemoSeeds,
  firstDemoFixtureRequested,
} from "./firstDemoFixture.ts";

const pageUrl = "https://example.test/app/plasmon/index.html";
const flaggedUrl = `${pageUrl}?plasmon-fixture=first-demo`;

function deterministicWindows(): NativeWindowManager {
  let nextWindowId = 0;
  return new NativeWindowManager({
    idFactory: () => `window:first-demo:${++nextWindowId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
}

test("normal production URL does not request first-demo content", async () => {
  expect(firstDemoFixtureRequested(pageUrl)).toBe(false);
  expect(createFirstDemoSeeds(pageUrl)).toEqual([]);

  const windows = deterministicWindows();
  const services = createPlasmonServices({
    filesystemRepository: new MemoryFsRepository(),
    neutron: new MockNeutronBridge({ elements: [] }),
    windows,
  });
  try {
    await services.filesystem.ready;
    expect(await services.fs.resolvePath(FIRST_DEMO_TEXT_PATH)).toBeNull();
    expect(await services.fs.resolvePath(FIRST_DEMO_MARKDOWN_PATH)).toBeNull();
    expect(await services.fs.resolvePath(FIRST_DEMO_IMAGE_PATH)).toBeNull();
  } finally {
    services.filesystem.dispose();
    windows.dispose();
  }
});

test("the explicit first-demo flag creates authored redistribution-safe document and image seeds", () => {
  const seeds = createFirstDemoSeeds(flaggedUrl);

  expect(firstDemoFixtureRequested(flaggedUrl)).toBe(true);
  expect(seeds).toHaveLength(5);
  expect(seeds.map(({ key }) => key)).toEqual([
    "demo.first.documents-directory.v1",
    "demo.first.pictures-directory.v1",
    "demo.first.notes.v1",
    "demo.first.guide.v1",
    "demo.first.artwork.v1",
  ]);
  expect(seeds.some((seed) => seed.parentPath === "/Games")).toBe(false);

  const byName = new Map(seeds.map((seed) => [seed.name, seed] as const));
  expect(byName.get("First Demo Notes.txt")).toMatchObject({
    seedClass: "demo-temporary",
    parentPath: "/Documents",
    kind: "file",
    mime: "text/plain",
  });
  expect(byName.get("First Demo Guide.md")).toMatchObject({
    seedClass: "demo-temporary",
    parentPath: "/Documents",
    kind: "file",
    mime: "text/markdown",
  });
  expect(byName.get("First Demo Artwork.svg")).toMatchObject({
    seedClass: "demo-temporary",
    parentPath: "/Pictures",
    kind: "file",
    mime: "image/svg+xml",
  });

  const decoder = new TextDecoder();
  expect(decoder.decode(byName.get("First Demo Notes.txt")?.bytes)).toContain("authored for the Plasmon acceptance environment");
  expect(decoder.decode(byName.get("First Demo Guide.md")?.bytes)).toContain("redistribution-safe Markdown fixture");
  expect(decoder.decode(byName.get("First Demo Artwork.svg")?.bytes)).toContain("Plasmon First Demo");
});

test("first-demo resources traverse production bootstrap, Search classification, and native associations", async () => {
  const windows = deterministicWindows();
  const services = createPlasmonServices({
    filesystemRepository: new MemoryFsRepository(),
    neutron: new MockNeutronBridge({ elements: [] }),
    windows,
    demoSeeds: createFirstDemoSeeds(flaggedUrl),
  });

  try {
    await services.filesystem.ready;

    const expected = [
      { path: FIRST_DEMO_TEXT_PATH, name: "First Demo Notes.txt", mime: "text/plain", handler: "native:text", category: "documents" },
      { path: FIRST_DEMO_MARKDOWN_PATH, name: "First Demo Guide.md", mime: "text/markdown", handler: "native:markdown", category: "documents" },
      { path: FIRST_DEMO_IMAGE_PATH, name: "First Demo Artwork.svg", mime: "image/svg+xml", handler: "native:photos", category: "media" },
    ] as const;

    const search = await searchFilesystem(services.fs, "First Demo");
    expect(search.warnings).toEqual([]);
    expect(search.truncated).toBe(false);
    const searchFiles = search.results.filter((result) => result.kind === "file");

    for (const item of expected) {
      const node = await services.fs.resolvePath(item.path);
      expect(node).toMatchObject({ name: item.name, kind: "file", mime: item.mime });
      if (!node) throw new Error(`Missing first-demo fixture ${item.path}`);

      const result = searchFiles.find((entry) => entry.node.id === node.id);
      expect(result).toMatchObject({ title: item.name, category: item.category });

      const handlers = (await services.associations.resolve(node)).map(({ id }) => id);
      expect(handlers[0]).toBe(item.handler);

      await services.filesystem.open.openNode(node.id);
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
