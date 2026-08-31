import { test } from "bun:test";
import assert from "node:assert/strict";
import { bootstrapFilesystem } from "../../os/fs/managed.ts";
import { MemoryFsRepository } from "../../os/fs/repository.ts";
import { PersistentFsService } from "../../os/fs/service.ts";
import { explorerFavoritesAffectedByEvent, readDefaultExplorerFavorites } from "./favorites.ts";

test("default Favorites project the accepted root directories by NodeId", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  await bootstrapFilesystem(fs);

  const snapshot = await readDefaultExplorerFavorites(fs);
  assert.deepEqual(
    snapshot.nodes.map((node) => node.name),
    ["Apps", "Desktop", "Documents", "Games", "Music", "Pictures", "Shared", "Videos"],
  );
  assert.ok(snapshot.nodes.every((node) => node.parentId === snapshot.rootId));
  const apps = await fs.resolvePath("/Apps");
  assert.ok(apps);
  assert.equal(snapshot.appsId, apps.id);
  assert.equal(snapshot.nodes.find((node) => node.name === "Apps")?.id, apps.id);
  assert.equal(snapshot.nodes.some((node) => node.name === "System"), false);
  assert.equal(snapshot.nodes.some((node) => node.name === "Downloads"), false);

  const pictures = await fs.resolvePath("/Pictures");
  assert.ok(pictures);
  await fs.rename(pictures.id, "Photos");
  const renamed = await readDefaultExplorerFavorites(fs);
  assert.equal(renamed.nodes.find((node) => node.name === "Photos")?.id, pictures.id);

  const root = await fs.resolvePath("/");
  assert.ok(root);
  const projects = await fs.mkdir(root.id, "Projects");
  const customized = await readDefaultExplorerFavorites(fs);
  assert.equal(customized.nodes.find((node) => node.name === "Projects")?.id, projects.id);
});

test("Favorites invalidation remains bounded to root inventory changes", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  await bootstrapFilesystem(fs);
  const snapshot = await readDefaultExplorerFavorites(fs);
  const documents = await fs.resolvePath("/Documents");
  assert.ok(documents);

  const nested = await fs.mkdir(documents.id, "Nested");
  assert.equal(
    explorerFavoritesAffectedByEvent({ type: "created", node: nested }, snapshot.rootId),
    false,
  );

  const projects = await fs.mkdir(snapshot.rootId, "Projects");
  assert.equal(
    explorerFavoritesAffectedByEvent({ type: "created", node: projects }, snapshot.rootId),
    true,
  );
  assert.equal(
    explorerFavoritesAffectedByEvent({ type: "removed", id: projects.id, parentId: snapshot.rootId }, snapshot.rootId),
    true,
  );
  assert.equal(
    explorerFavoritesAffectedByEvent({ type: "reset", revision: await fs.revision() }, snapshot.rootId),
    true,
  );
});

test("a preserved legacy Downloads directory is not a default Favorite", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  assert.ok(root);
  const downloads = await fs.mkdir(root.id, "Downloads");
  await fs.createFile(downloads.id, "archive.zip");

  await bootstrapFilesystem(fs);

  assert.equal((await fs.resolvePath("/Downloads"))?.id, downloads.id);
  assert.equal(
    (await readDefaultExplorerFavorites(fs)).nodes.some((node) => node.id === downloads.id),
    false,
  );
});
