import { expect, test } from "bun:test";
import type { FsNode } from "../../os/contracts/index.ts";
import { SYSTEM_APP_METADATA_KEY } from "../../os/fs/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import {
  RecycleBinModel,
  subscribeRecycleBinInvalidation,
} from "./model.ts";

async function createDocument(
  env: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  name: string,
): Promise<FsNode> {
  const documents = await env.node("/Documents");
  if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");
  return env.services.fs.createFile(documents.id, name, { mime: "text/plain" });
}

test("native Recycle Bin is registered, bootstrapped, and launchable", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const app = env.services.nativeApps.getByHandler("native:recycle-bin");
    expect(app?.id).toBe("native:recycle-bin");
    expect(app?.singleton).toBe(true);
    expect(env.services.nativeApps.hasLoader("native:recycle-bin")).toBe(true);

    const systemNode = await env.node("/System/RecycleBin.sys");
    expect(systemNode?.mime).toBe("application/x-plasmon-system-app");
    expect(systemNode?.metadata[SYSTEM_APP_METADATA_KEY]).toMatchObject({
      format: "plasmon.system-app",
      systemId: "native:recycle-bin",
      handlerId: "native:recycle-bin",
    });

    await env.open("/System/RecycleBin.sys");
    expect(env.processes().map((process) => process.handlerId)).toContain("native:recycle-bin");
  } finally {
    env.dispose();
  }
});

test("RecycleBinModel lists and restores through canonical TrashService", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const source = await createDocument(env, "recover-me.txt");
    await env.services.filesystem.trash.trash(source.id);
    const model = new RecycleBinModel(env.services.filesystem.trash);

    expect(await model.list()).toEqual([
      expect.objectContaining({
        id: source.id,
        name: "recover-me.txt",
        originalPath: "/Documents/recover-me.txt",
        kind: "file",
      }),
    ]);

    const [restored] = await model.restore([source.id]);
    expect(restored).toMatchObject({ itemId: source.id, nodeId: source.id, usedFallback: false, renamed: false });
    expect((await env.node("/Documents/recover-me.txt"))?.id).toBe(source.id);
    expect(await model.list()).toEqual([]);
  } finally {
    env.dispose();
  }
});

test("RecycleBinModel permanently deletes selected items", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const source = await createDocument(env, "delete-me.txt");
    await env.services.filesystem.trash.trash(source.id);
    const model = new RecycleBinModel(env.services.filesystem.trash);

    expect(await model.permanentlyDelete([source.id, source.id])).toBe(1);
    expect(await model.list()).toEqual([]);
    await expect(env.services.fs.stat(source.id)).rejects.toThrow();
  } finally {
    env.dispose();
  }
});

test("RecycleBinModel empties all canonical Trash entries", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const first = await createDocument(env, "first.txt");
    const second = await createDocument(env, "second.txt");
    await env.services.filesystem.trash.trash(first.id);
    await env.services.filesystem.trash.trash(second.id);
    const model = new RecycleBinModel(env.services.filesystem.trash);

    expect((await model.list()).map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(await model.empty()).toBe(2);
    expect(await model.list()).toEqual([]);
  } finally {
    env.dispose();
  }
});

test("filesystem events invalidate the Recycle Bin view and canonical reload sees external changes", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const model = new RecycleBinModel(env.services.filesystem.trash);
    let invalidations = 0;
    const unsubscribe = subscribeRecycleBinInvalidation(env.services.fsEvents, () => { invalidations += 1; });
    const source = await createDocument(env, "external-trash.txt");
    invalidations = 0;

    await env.services.filesystem.trash.trash(source.id);
    expect(invalidations).toBeGreaterThan(0);
    expect((await model.list()).map((item) => item.id)).toContain(source.id);
    unsubscribe();
  } finally {
    env.dispose();
  }
});
