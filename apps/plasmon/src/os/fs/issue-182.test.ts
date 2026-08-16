import { test } from "bun:test";
import assert from "node:assert/strict";
import { MemoryFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import { bootstrapFilesystem } from "./managed.ts";

test("issue #182: fresh Plasmon omits Downloads from the root inventory", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  await bootstrapFilesystem(fs);

  const root = await fs.resolvePath("/");
  assert.ok(root);
  assert.equal(root.kind, "directory");
  assert.deepEqual(
    (await fs.list(root.id, { includeHidden: true, sort: "name" })).map((node) => node.name),
    ["Apps", "Desktop", "Documents", "Games", "Music", "Pictures", "Shared", "System", "Videos"],
  );
  assert.equal(await fs.resolvePath("/Downloads"), null);
});

test("issue #182: bootstrap preserves an existing Downloads tree without guessing ownership", async () => {
  const repository = new MemoryFsRepository();
  const fs = new PersistentFsService(repository);
  const root = await fs.resolvePath("/");
  assert.ok(root);

  const downloads = await fs.mkdir(root.id, "Downloads");
  const child = await fs.createFile(downloads.id, "keep.txt", { mime: "text/plain" });
  await fs.write(child.id, new TextEncoder().encode("preserve me"), { truncate: true });

  await bootstrapFilesystem(fs);
  const reloaded = new PersistentFsService(repository);
  await bootstrapFilesystem(reloaded);

  const preservedDownloads = await reloaded.resolvePath("/Downloads");
  const preservedChild = await reloaded.resolvePath("/Downloads/keep.txt");
  assert.equal(preservedDownloads?.id, downloads.id);
  assert.equal(preservedChild?.id, child.id);
  assert.equal(new TextDecoder().decode(await reloaded.read(child.id)), "preserve me");
});
