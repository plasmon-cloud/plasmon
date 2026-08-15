import { expect, test } from "bun:test";
import { MemoryFsRepository } from "./repository.ts";
import {
  RESOURCE_ARTWORK_MAX_BYTES,
  readResourceArtworkMetadata,
  resourceArtworkMetadata,
} from "./resourceArtwork.ts";
import { PersistentFsService } from "./service.ts";

const artwork = () => resourceArtworkMetadata({
  src: "static/plasmon/artwork/plasmon-demo.svg",
  mime: "image/svg+xml",
  byteSize: 1193,
});

test("#123 artwork metadata rejects non-local, mismatched, and oversized declarations", () => {
  expect(() => resourceArtworkMetadata({
    src: "https://covers.invalid/game.svg",
    mime: "image/svg+xml",
    byteSize: 10,
  })).toThrow();
  expect(() => resourceArtworkMetadata({
    src: "static/plasmon/artwork/game.svg",
    mime: "image/png",
    byteSize: 10,
  })).toThrow();
  expect(() => resourceArtworkMetadata({
    src: "static/plasmon/artwork/game.svg",
    mime: "image/svg+xml",
    byteSize: RESOURCE_ARTWORK_MAX_BYTES + 1,
  })).toThrow();
});

test("#123 artwork follows ordinary filesystem copy and stable-metadata semantics", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  const desktop = await fs.resolvePath("/Desktop");
  if (!root || !desktop) throw new Error("Filesystem roots are unavailable");
  const games = await fs.resolvePath("/Games") ?? await fs.mkdir(root.id, "Games");
  const original = await fs.createFile(games.id, "PlasmonDemo.jsdos", {
    mime: "application/x-jsdos",
    metadata: artwork(),
  });

  const copied = await fs.copy(original.id, desktop.id, "PlasmonDemo Copy.jsdos");
  expect(copied.id).not.toBe(original.id);
  expect(readResourceArtworkMetadata(copied)).toEqual(readResourceArtworkMetadata(original));

  const renamed = await fs.rename(copied.id, "RenamedDemo.jsdos");
  expect(renamed.id).toBe(copied.id);
  expect(readResourceArtworkMetadata(renamed)).toEqual(readResourceArtworkMetadata(original));
});
