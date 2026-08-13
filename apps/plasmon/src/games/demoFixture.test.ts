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
  loadPackagedDemoGameSeeds,
  packagedDemoGameRequested,
} from "./demoFixture.ts";
import { createPlasmonDemoGameBundle } from "./demoFixtureBundle.ts";

const pageUrl = "https://example.test/app/plasmon/index.html";

test("normal boot does not load or seed the packaged demo game", async () => {
  let fetches = 0;
  const seeds = await loadPackagedDemoGameSeeds(pageUrl, async () => {
    fetches += 1;
    return new Response(new Uint8Array([1]));
  });

  expect(packagedDemoGameRequested(pageUrl)).toBe(false);
  expect(fetches).toBe(0);
  expect(seeds).toEqual([]);
});

test("the explicit demo-game flag resolves one package asset into the demo-seed authority", async () => {
  let fetched: string | null = null;
  const flagged = `${pageUrl}?plasmon-fixture=demo-game`;
  const seeds = await loadPackagedDemoGameSeeds(flagged, async (input) => {
    fetched = input.toString();
    return new Response(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]));
  });

  expect(packagedDemoGameRequested(flagged)).toBe(true);
  expect(fetched).toBe("https://example.test/app/plasmon/fixtures/PlasmonDemo.jsdos");
  expect(DEMO_GAME_FIXTURE_PATH).toBe("/Games/Plasmon Demo.jsdos");
  expect(seeds).toHaveLength(1);
  expect(seeds[0]).toMatchObject({
    key: "games.demo.plasmon-v1",
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: "Plasmon Demo.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
  });
  expect(Array.from(seeds[0]?.bytes ?? [])).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test("the explicit packaged fixture survives hosted filesystem transport and opens through the production js-dos association", async () => {
  const bundle = createPlasmonDemoGameBundle();
  const flagged = `${pageUrl}?plasmon-fixture=demo-game`;
  const seeds = await loadPackagedDemoGameSeeds(
    flagged,
    async () => new Response(bundle.slice()),
  );

  const repository = new MemoryFsRepository();
  const backgroundFs = new PersistentFsService(repository);
  const server = new FsRpcServer(backgroundFs);
  const foregroundFs = new FsRpcClient((name, args) => server.call(name, args));

  await bootstrapFilesystem(foregroundFs, { demoSeeds: seeds });

  const transported = await foregroundFs.resolvePath(DEMO_GAME_FIXTURE_PATH);
  expect(transported).toMatchObject({
    name: "Plasmon Demo.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
  });
  if (!transported) throw new Error("Hosted demo fixture was not created");
  expect(Array.from(await foregroundFs.read(transported.id))).toEqual(Array.from(bundle));

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
  });

  try {
    await services.filesystem.ready;
    const node = await services.fs.resolvePath(DEMO_GAME_FIXTURE_PATH);
    expect(node).toMatchObject({
      id: transported.id,
      name: "Plasmon Demo.jsdos",
      kind: "file",
      mime: "application/x-jsdos",
    });
    if (!node) throw new Error("Composed demo fixture was not visible in filesystem inventory");

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
