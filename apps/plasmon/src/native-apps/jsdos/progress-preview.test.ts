import { expect, test } from "bun:test";
import { readResourcePreviewMetadata, RESOURCE_PREVIEW_MAX_BYTES } from "../../os/fs/resourcePreview.ts";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import {
  JsDosProgressStore,
  jsDosProgressPath,
  jsDosProgressPreviewPath,
} from "./progress.ts";

async function fixture() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("test filesystem root is unavailable");
  const games = await fs.mkdir(root.id, "Preview Games");
  const game = await fs.createFile(games.id, "Preview.jsdos", { mime: "application/x-jsdos" });
  await fs.write(game.id, Uint8Array.from([0x50, 0x4b, 1]), { truncate: true });
  const store = new JsDosProgressStore(fs, game.id);
  const progress = Uint8Array.from([0x50, 0x4b, 9, 8, 7, 6]);
  await store.save(progress);
  return { fs, game, store, progress };
}

test("preview metadata references one bounded filesystem image on the canonical save and visible game projection", async () => {
  const { fs, game, store } = await fixture();
  const first = await store.savePreview({
    bytes: Uint8Array.from([137, 80, 78, 71, 1, 2, 3]),
    mime: "image/png",
    width: 320,
    height: 200,
  });
  expect(first).not.toBeNull();

  const expectedFirst = {
    format: "plasmon.resource-preview" as const,
    version: 1 as const,
    source: "filesystem-node" as const,
    nodeId: first!.id,
    mime: "image/png" as const,
    byteSize: 7,
    width: 320,
    height: 200,
  };
  const save = await fs.resolvePath(jsDosProgressPath(game.id));
  if (!save) throw new Error("save record missing");
  expect(readResourcePreviewMetadata(save)).toEqual(expectedFirst);
  expect(readResourcePreviewMetadata(await fs.stat(game.id))).toEqual(expectedFirst);

  const second = await store.savePreview({
    bytes: Uint8Array.from([137, 80, 78, 71, 4, 5]),
    mime: "image/png",
    width: 240,
    height: 150,
  });
  expect(second?.id).toBe(first?.id);
  expect(Array.from(await fs.read(second!.id))).toEqual([137, 80, 78, 71, 4, 5]);
  expect(readResourcePreviewMetadata(await fs.stat(game.id))).toEqual({
    ...expectedFirst,
    byteSize: 6,
    width: 240,
    height: 150,
  });

  const directory = await fs.resolvePath("/.jsdos-progress");
  if (!directory) throw new Error("progress directory missing");
  const entries = await fs.list(directory.id, { includeHidden: true });
  expect(entries.filter((entry) => entry.name.endsWith(".preview.png"))).toHaveLength(1);
  expect(await fs.resolvePath(jsDosProgressPreviewPath(game.id))).not.toBeNull();
});

test("missing preview bytes never affect authoritative progress correctness", async () => {
  const { fs, game, store, progress } = await fixture();
  const preview = await store.savePreview({
    bytes: Uint8Array.from([137, 80, 78, 71, 1]),
    mime: "image/png",
    width: 160,
    height: 100,
  });
  if (!preview) throw new Error("preview was not created");

  await fs.remove(preview.id);

  expect(Array.from(await store.load() ?? [])).toEqual(Array.from(progress));
  const save = await fs.resolvePath(jsDosProgressPath(game.id));
  if (!save) throw new Error("save record missing");
  expect(readResourcePreviewMetadata(save)?.nodeId).toBe(preview.id);
  expect(readResourcePreviewMetadata(await fs.stat(game.id))?.nodeId).toBe(preview.id);
});

test("oversized preview capture is ignored without rewriting the save or visible game presentation", async () => {
  const { fs, game, store, progress } = await fixture();
  const result = await store.savePreview({
    bytes: new Uint8Array(RESOURCE_PREVIEW_MAX_BYTES + 1),
    mime: "image/png",
    width: 320,
    height: 200,
  });

  expect(result).toBeNull();
  expect(Array.from(await store.load() ?? [])).toEqual(Array.from(progress));
  const save = await fs.resolvePath(jsDosProgressPath(game.id));
  if (!save) throw new Error("save record missing");
  expect(readResourcePreviewMetadata(save)).toBeNull();
  expect(readResourcePreviewMetadata(await fs.stat(game.id))).toBeNull();
});
