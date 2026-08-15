import { expect, test } from "bun:test";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import {
  JS_DOS_PROGRESS_METADATA_KEY,
  JsDosProgressStore,
  createJsDosFsChanges,
  jsDosProgressPath,
} from "./progress.ts";

async function fixture() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const documents = await fs.resolvePath("/Documents");
  const downloads = await fs.resolvePath("/Downloads");
  if (!documents || !downloads) throw new Error("test filesystem defaults are unavailable");
  const game = await fs.createFile(documents.id, "Game.jsdos", { mime: "application/x-jsdos" });
  await fs.write(game.id, Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), { truncate: true });
  return { fs, game, documents, downloads };
}

test("js-dos progress remains associated with stable game NodeId across rename and move", async () => {
  const { fs, game, downloads } = await fixture();
  const progress = new JsDosProgressStore(fs, game.id);
  const saved = Uint8Array.from([0x50, 0x4b, 1, 2, 3, 4]);

  await progress.save(saved);
  await fs.rename(game.id, "Renamed.jsdos");
  await fs.move(game.id, downloads.id);

  expect(Array.from(await progress.load() ?? [])).toEqual(Array.from(saved));
  expect(await fs.resolvePath(jsDosProgressPath(game.id))).not.toBeNull();
});

test("copied game gets a distinct progress identity", async () => {
  const { fs, game, downloads } = await fixture();
  await new JsDosProgressStore(fs, game.id).save(Uint8Array.from([0x50, 0x4b, 7]));
  const copy = await fs.copy(game.id, downloads.id, "Copy.jsdos");

  expect(copy.id).not.toBe(game.id);
  expect(await new JsDosProgressStore(fs, copy.id).load()).toBeNull();
});

test("corrupt saved progress fails safely with a warning", async () => {
  const { fs, game } = await fixture();
  const warnings: string[] = [];
  const progress = new JsDosProgressStore(fs, game.id, (message) => warnings.push(message));
  await progress.save(Uint8Array.from([0x50, 0x4b, 9, 9]));
  const save = await fs.resolvePath(jsDosProgressPath(game.id));
  if (!save) throw new Error("progress file was not created");

  await fs.write(save.id, Uint8Array.from([1, 2, 3]), { truncate: true });

  expect(await progress.load()).toBeNull();
  expect(warnings).toEqual(["Saved js-dos progress is corrupt; starting without saved progress."]);
});

test("incompatible runtime progress fails safely without changing the game resource", async () => {
  const { fs, game } = await fixture();
  const warnings: string[] = [];
  const progress = new JsDosProgressStore(fs, game.id, (message) => warnings.push(message));
  await progress.save(Uint8Array.from([0x50, 0x4b, 5]));
  const save = await fs.resolvePath(jsDosProgressPath(game.id));
  if (!save) throw new Error("progress file was not created");
  const metadata = save.metadata[JS_DOS_PROGRESS_METADATA_KEY];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("progress metadata missing");

  await fs.setMetadata(save.id, {
    [JS_DOS_PROGRESS_METADATA_KEY]: { ...metadata, runtimeVersion: "9.0.0" },
  });

  expect(await progress.load()).toBeNull();
  expect(warnings).toEqual(["Saved js-dos progress was created by an incompatible runtime; starting without saved progress."]);
  expect((await fs.stat(game.id)).name).toBe("Game.jsdos");
});

test("js-dos fsChanges disables browser-local saves and round-trips through Plasmon filesystem", async () => {
  const { fs, game } = await fixture();
  const restored: boolean[] = [];
  let saved = 0;
  const changes = createJsDosFsChanges(fs, game.id, {
    onRestored: (value) => restored.push(value),
    onSaved: () => { saved += 1; },
  });

  expect(changes.local).toBe(false);
  const key = await changes.urlToKey("blob:https://runtime.invalid/mutable-name.jsdos");
  expect(key).toBe(game.id);
  expect(await changes.pull(key)).toBeNull();

  const bytes = Uint8Array.from([0x50, 0x4b, 8, 6, 4, 2]);
  await changes.push(key, bytes);
  expect(Array.from(await changes.pull(key) ?? [])).toEqual(Array.from(bytes));
  expect(restored).toEqual([false, true]);
  expect(saved).toBe(1);
});
