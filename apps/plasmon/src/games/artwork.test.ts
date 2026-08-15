import { expect, test } from "bun:test";
import { readResourceArtworkMetadata } from "../os/fs/index.ts";
import { MemoryFsRepository } from "../os/fs/repository.ts";
import { PersistentFsService } from "../os/fs/service.ts";
import {
  PACKAGED_DEMO_GAME_ARTWORK_BYTES,
  PACKAGED_DEMO_GAME_ARTWORK_MIME,
  PACKAGED_DEMO_GAME_ARTWORK_SRC,
  reconcilePackagedDemoGameArtwork,
} from "./artwork.ts";
import { PACKAGED_DEMO_GAME_NAME } from "./demoFixture.ts";

test("#123 legal demo fixture receives canonical package artwork idempotently", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root) throw new Error("Filesystem root is unavailable");
  const games = await fs.resolvePath("/Games") ?? await fs.mkdir(root.id, "Games");
  const game = await fs.createFile(games.id, PACKAGED_DEMO_GAME_NAME, { mime: "application/x-jsdos" });

  expect(await reconcilePackagedDemoGameArtwork(fs)).toBe(true);
  expect(await reconcilePackagedDemoGameArtwork(fs)).toBe(false);
  expect(readResourceArtworkMetadata(await fs.stat(game.id))).toEqual({
    format: "plasmon.resource-artwork",
    version: 1,
    source: "package-local",
    src: PACKAGED_DEMO_GAME_ARTWORK_SRC,
    mime: PACKAGED_DEMO_GAME_ARTWORK_MIME,
    byteSize: PACKAGED_DEMO_GAME_ARTWORK_BYTES,
  });
});
