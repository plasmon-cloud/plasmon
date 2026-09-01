import { expect, test } from "bun:test";
import {
  MemoryFsRepository,
  PersistentFsService,
  FsRpcClient,
  FsRpcServer,
  bootstrapFilesystem,
} from "../os/fs/index.ts";
import { createPlasmonServices } from "../os/integration/services.ts";
import { MockNeutronBridge } from "../os/neutron/index.ts";
import { NativeWindowManager } from "../os/windowing/index.ts";
import {
  DEMO_GAME_FIXTURE_PATH,
  loadPackagedDemoGameSeed,
  loadPackagedDemoGameSeeds,
  packagedDemoGameRequested,
} from "./demoFixture.ts";
import { createPlasmonDemoGameBundle } from "./demoFixtureBundle.ts";

const pageUrl = "https://example.test/app/plasmon/index.html";

test("normal Base boot does not load or seed the packaged demo game", async () => {
  let fetches = 0;
  const seeds = await loadPackagedDemoGameSeeds(pageUrl, async () => {
    fetches += 1;
    return new Response(new Uint8Array([1]));
  });

  expect(packagedDemoGameRequested(pageUrl)).toBe(false);
  expect(fetches).toBe(0);
  expect(seeds).toEqual([]);
});

test("Demo product loader resolves the package-owned game into the ordinary seed authority", async () => {
  let fetched: string | null = null;
  const seed = await loadPackagedDemoGameSeed(pageUrl, async (input) => {
    fetched = input.toString();
    return new Response(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]));
  });

  expect(fetched).toBe("https://example.test/app/plasmon/fixtures/PlasmonDemo.jsdos");
  expect(DEMO_GAME_FIXTURE_PATH).toBe("/Games/Plasmon Demo.jsdos");
  expect(seed).toMatchObject({
    key: "games.demo.plasmon-v1",
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: "Plasmon Demo.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
  });
  expect(Array.from(seed.bytes ?? [])).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test("the explicit Specialist flag reuses the same package asset and seed authority", async () => {
  const flagged = `${pageUrl}?plasmon-fixture=demo-game`;
  const seeds = await loadPackagedDemoGameSeeds(flagged, async () =>
    new Response(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))
  );

  expect(packagedDemoGameRequested(flagged)).toBe(true);
  expect(seeds).toHaveLength(1);
  expect(seeds[0]).toMatchObject({
    key: "games.demo.plasmon-v1",
    parentPath: "/Games",
    name: "Plasmon Demo.jsdos",
  });
});

test("Demo game reconciliation is idempotent and opens through the production js-dos association", async () => {
  const bundle = createPlasmonDemoGameBundle();
  const seed = await loadPackagedDemoGameSeed(
    pageUrl,
    async () => new Response(bundle.slice()),
  );

  const repository = new MemoryFsRepository();
  const backgroundFs = new PersistentFsService(repository);
  const server = new FsRpcServer(backgroundFs);
  const foregroundFs = new FsRpcClient((name, args) => server.call(name, args));

  await bootstrapFilesystem(foregroundFs, { demoSeeds: [seed] });
  const first = await foregroundFs.resolvePath(DEMO_GAME_FIXTURE_PATH);
  if (!first) throw new Error("Demo game seed was not created");
  await bootstrapFilesystem(foregroundFs, { demoSeeds: [seed] });
  const second = await foregroundFs.resolvePath(DEMO_GAME_FIXTURE_PATH);
  expect(second?.id).toBe(first.id);
  expect(Array.from(await foregroundFs.read(first.id))).toEqual(Array.from(bundle));

  const neutron = new MockNeutronBridge({ elements: [] });
  let nextWindowId = 0;
  const windows = new NativeWindowManager({
    idFactory: () => `window:demo:${++nextWindowId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  const services = createPlasmonServices({
    filesystemRepository: repository,
    neutron,
    windows,
    runtimeSelection: { jsDos: true, emulatorJs: true },
  });

  try {
    await services.filesystem.ready;
    const node = await services.fs.resolvePath(DEMO_GAME_FIXTURE_PATH);
    expect(node).toMatchObject({
      id: first.id,
      name: "Plasmon Demo.jsdos",
      kind: "file",
      mime: "application/x-jsdos",
    });
    if (!node) throw new Error("Composed demo game was not visible in filesystem inventory");

    const handlers = (await services.associations.resolve(node)).map(({ id }) => id);
    expect(handlers[0]).toBe("runtime:js-dos");
    expect(handlers).toContain("native:text");
    await services.filesystem.open.openNode(node.id);

    const processes = services.process.list();
    expect(processes).toHaveLength(1);
    expect(processes[0]).toMatchObject({
      handlerId: "runtime:js-dos",
      target: { nodeId: node.id },
    });
    expect(processes[0]?.windowId).not.toBeNull();

    const openedWindows = services.windows.list();
    expect(openedWindows).toHaveLength(1);
    expect(openedWindows[0]?.id).toBe(processes[0]?.windowId);
    expect(openedWindows[0]?.processId).toBe(processes[0]?.id);
  } finally {
    for (const process of services.process.list()) services.process.close(process.id);
    services.filesystem.dispose();
    windows.dispose();
  }
});
