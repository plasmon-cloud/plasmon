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
import { createPlasmonDemoGameBundle } from "./demoFixtureBundle.ts";
import {
  DEMO_NES_LICENSE_PATH,
  DEMO_NES_PATH,
  loadPackagedProductDemoGameSeeds,
} from "./demoFixture.ts";
import { createPlasmonNesDemoRom } from "./demoNesBundle.ts";

const pageUrl = "https://example.test/app/plasmon/index.html";

async function demoSeeds() {
  const jsDos = createPlasmonDemoGameBundle();
  const nes = createPlasmonNesDemoRom();
  return loadPackagedProductDemoGameSeeds(pageUrl, async (input) => {
    const url = input.toString();
    if (url.endsWith("/fixtures/PlasmonDemo.jsdos")) return new Response(jsDos.slice());
    if (url.endsWith("/fixtures/PlasmonNesDemo.nes")) return new Response(nes.slice());
    return new Response(null, { status: 404 });
  });
}

test("Demo product content reconciles NES homebrew and attribution idempotently", async () => {
  const seeds = await demoSeeds();
  expect(seeds.map(({ name }) => name)).toEqual([
    "Plasmon Demo.jsdos",
    "Plasmon NES Demo.nes",
    "Plasmon NES Demo - LICENSE.txt",
  ]);

  const repository = new MemoryFsRepository();
  const fs = new PersistentFsService(repository);
  await bootstrapFilesystem(fs, { demoSeeds: seeds });
  const first = await fs.resolvePath(DEMO_NES_PATH);
  const license = await fs.resolvePath(DEMO_NES_LICENSE_PATH);
  if (!first || !license) throw new Error("Demo NES content was not reconciled");
  await bootstrapFilesystem(fs, { demoSeeds: seeds });
  const second = await fs.resolvePath(DEMO_NES_PATH);

  expect(second?.id).toBe(first.id);
  expect(await fs.read(first.id)).toEqual(createPlasmonNesDemoRom());
  expect(new TextDecoder().decode(await fs.read(license.id))).toContain("GPL-3.0-only");
});

test("user-facing NES Demo opens through ordinary EmulatorJS association and Process/Window authority", async () => {
  const seeds = await demoSeeds();
  const repository = new MemoryFsRepository();
  const backgroundFs = new PersistentFsService(repository);
  const server = new FsRpcServer(backgroundFs);
  const foregroundFs = new FsRpcClient((name, args) => server.call(name, args));
  await bootstrapFilesystem(foregroundFs, { demoSeeds: seeds });

  const neutron = new MockNeutronBridge({ elements: [] });
  let nextWindowId = 0;
  const windows = new NativeWindowManager({
    idFactory: () => `window:demo-nes:${++nextWindowId}`,
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
    const node = await services.fs.resolvePath(DEMO_NES_PATH);
    if (!node) throw new Error("Demo NES resource was not visible in composed filesystem");
    expect(node).toMatchObject({ name: "Plasmon NES Demo.nes", kind: "file" });

    const handlers = (await services.associations.resolve(node)).map(({ id }) => id);
    expect(handlers[0]).toBe("runtime:emulatorjs");
    await services.filesystem.open.openNode(node.id);

    const processes = services.process.list();
    expect(processes).toHaveLength(1);
    expect(processes[0]).toMatchObject({
      handlerId: "runtime:emulatorjs",
      target: { nodeId: node.id },
    });
    expect(processes[0]?.windowId).not.toBeNull();
    expect(services.windows.list()).toHaveLength(1);
    expect(services.windows.list()[0]?.processId).toBe(processes[0]?.id);
  } finally {
    for (const process of services.process.list()) services.process.close(process.id);
    services.filesystem.dispose();
    windows.dispose();
  }
});
