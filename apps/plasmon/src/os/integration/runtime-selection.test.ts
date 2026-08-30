import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";

type RuntimeSelection = { readonly jsDos: boolean; readonly emulatorJs: boolean };

async function withRuntimeSelection<T>(
  runtimeSelection: RuntimeSelection,
  run: (env: ReturnType<typeof createHeadlessPlasmonEnvironment>) => Promise<T>,
): Promise<T> {
  const env = createHeadlessPlasmonEnvironment({ runtimeSelection });
  try {
    await env.ready;
    return await run(env);
  } finally {
    env.dispose();
  }
}

async function createDosBundle(env: ReturnType<typeof createHeadlessPlasmonEnvironment>) {
  const path = "/Documents/Selection Probe.jsdos";
  const contents = "PK\u0003\u0004selection-probe";
  const game = await env.os.fs.writeText(path, contents);
  expect(await env.os.fs.readText(path)).toBe(contents);
  return game;
}

test("Base with no optional runtime selection does not expose js-dos", async () => {
  await withRuntimeSelection({ jsDos: false, emulatorJs: false }, async (env) => {
    expect(env.services.nativeApps.getByHandler("runtime:js-dos")).toBeNull();
    const game = await createDosBundle(env);
    const opened = await env.os.open(game.path);
    expect(opened.handlerId).not.toBe("runtime:js-dos");
    expect(env.os.processes.list().some(({ handlerId }) => handlerId === "runtime:js-dos")).toBe(false);
  });
});

test("selected js-dos opens through OsApi and ordinary filesystem operations", async () => {
  await withRuntimeSelection({ jsDos: true, emulatorJs: false }, async (env) => {
    expect(env.services.nativeApps.list().filter(({ handlerId }) => handlerId === "runtime:js-dos")).toHaveLength(1);
    expect(env.services.nativeApps.getByHandler("runtime:emulatorjs")).toBeNull();

    const game = await createDosBundle(env);
    await env.os.fs.createDirectory("/Documents/Runtime Selection");
    const copied = await env.os.fs.copy(game.path, "/Documents/Runtime Selection");
    expect(await env.os.fs.readText(copied.path)).toBe("PK\u0003\u0004selection-probe");

    const moved = await env.os.fs.move(copied.path, "/Desktop");
    expect(await env.os.fs.exists(copied.path)).toBe(false);
    expect(await env.os.fs.exists(moved.path)).toBe(true);
    await env.os.fs.remove(moved.path);
    expect(await env.os.fs.exists(moved.path)).toBe(false);

    const opened = await env.os.open(game.path);
    expect(opened.handlerId).toBe("runtime:js-dos");
    expect(opened.processId).toBeTruthy();
    expect(opened.windowId).toBeTruthy();

    const process = env.os.processes.list().find(({ id }) => id === opened.processId);
    expect(process).toEqual(expect.objectContaining({
      appId: "runtime:js-dos",
      handlerId: "runtime:js-dos",
      state: "running",
      windowId: opened.windowId,
    }));
    expect(env.os.windows.list()).toContainEqual(expect.objectContaining({
      id: opened.windowId,
      processId: opened.processId,
    }));
  });
});
