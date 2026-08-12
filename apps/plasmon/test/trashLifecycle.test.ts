import { expect, test } from "bun:test";
import type { FsNode } from "../src/os/contracts/index.ts";
import {
  deleteFailureMessage,
  deleteFilesystemNodes,
} from "../src/os/file-manager/index.ts";
import { RecycleBinModel } from "../src/native-apps/recycle-bin/model.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function requireDirectory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

test("FileManager Delete and Recycle Bin compose one canonical Trash lifecycle", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const protectedPhotos = await environment.node("/System/Photos.sys");
    if (!protectedPhotos) throw new Error("Photos.sys is unavailable");

    const restoreFile = await environment.services.fs.createFile(documents.id, "restore-me.txt", {
      mime: "text/plain",
    });
    const restoreFolder = await environment.services.fs.mkdir(documents.id, "Restore Folder");
    const restoreChild = await environment.services.fs.createFile(restoreFolder.id, "child.txt", {
      mime: "text/plain",
    });

    const initialDelete = await deleteFilesystemNodes(
      environment.services.filesystem.trash,
      [protectedPhotos, restoreFile, restoreFolder],
    );

    expect(initialDelete.deletedIds).toEqual([restoreFile.id, restoreFolder.id]);
    expect(initialDelete.failures).toEqual([
      {
        nodeId: protectedPhotos.id,
        name: "Photos.sys",
        message: "Photos.sys is protected and cannot be deleted",
      },
    ]);
    expect(deleteFailureMessage(initialDelete.failures)).toBe(
      "Photos.sys is protected and cannot be deleted",
    );
    expect((await environment.node("/System/Photos.sys"))?.id).toBe(protectedPhotos.id);
    expect(await environment.node("/Documents/restore-me.txt")).toBeNull();
    expect(await environment.node("/Documents/Restore Folder")).toBeNull();

    const canonicalEntries = await environment.services.filesystem.trash.list();
    const restoreFileEntry = canonicalEntries.find((entry) => entry.node.id === restoreFile.id);
    const restoreFolderEntry = canonicalEntries.find((entry) => entry.node.id === restoreFolder.id);

    expect(restoreFileEntry).toMatchObject({
      node: expect.objectContaining({ id: restoreFile.id, kind: "file" }),
      originalParentId: documents.id,
      originalName: "restore-me.txt",
      originalPath: "/Documents/restore-me.txt",
    });
    expect(restoreFolderEntry).toMatchObject({
      node: expect.objectContaining({ id: restoreFolder.id, kind: "directory" }),
      originalParentId: documents.id,
      originalName: "Restore Folder",
      originalPath: "/Documents/Restore Folder",
    });
    expect(restoreFileEntry?.deletedAt).toBeGreaterThan(0);
    expect(restoreFolderEntry?.deletedAt).toBeGreaterThan(0);
    expect((await environment.services.fs.stat(restoreChild.id)).id).toBe(restoreChild.id);

    const recycleBin = new RecycleBinModel(environment.services.filesystem.trash);
    expect((await recycleBin.list()).map((item) => item.id).sort()).toEqual(
      [restoreFile.id, restoreFolder.id].sort(),
    );

    const restored = await recycleBin.restore([restoreFile.id, restoreFolder.id]);
    expect(restored).toEqual([
      {
        itemId: restoreFile.id,
        nodeId: restoreFile.id,
        name: "restore-me.txt",
        usedFallback: false,
        renamed: false,
      },
      {
        itemId: restoreFolder.id,
        nodeId: restoreFolder.id,
        name: "Restore Folder",
        usedFallback: false,
        renamed: false,
      },
    ]);
    expect((await environment.node("/Documents/restore-me.txt"))?.id).toBe(restoreFile.id);
    expect((await environment.node("/Documents/Restore Folder"))?.id).toBe(restoreFolder.id);
    expect((await environment.node("/Documents/Restore Folder/child.txt"))?.id).toBe(restoreChild.id);
    expect(await recycleBin.list()).toEqual([]);

    const permanent = await environment.services.fs.createFile(documents.id, "delete-permanently.txt", {
      mime: "text/plain",
    });
    const emptyFirst = await environment.services.fs.createFile(documents.id, "empty-first.txt", {
      mime: "text/plain",
    });
    const emptySecond = await environment.services.fs.createFile(documents.id, "empty-second.txt", {
      mime: "text/plain",
    });

    const finalDelete = await deleteFilesystemNodes(
      environment.services.filesystem.trash,
      [permanent, emptyFirst, emptySecond],
    );
    expect(finalDelete.deletedIds).toEqual([permanent.id, emptyFirst.id, emptySecond.id]);
    expect(finalDelete.failures).toEqual([]);
    expect((await recycleBin.list()).map((item) => item.id).sort()).toEqual(
      [permanent.id, emptyFirst.id, emptySecond.id].sort(),
    );

    expect(await recycleBin.permanentlyDelete([permanent.id, permanent.id])).toBe(1);
    await expect(environment.services.fs.stat(permanent.id)).rejects.toThrow();
    expect((await recycleBin.list()).map((item) => item.id).sort()).toEqual(
      [emptyFirst.id, emptySecond.id].sort(),
    );

    expect(await recycleBin.empty()).toBe(2);
    expect(await recycleBin.list()).toEqual([]);
    await expect(environment.services.fs.stat(emptyFirst.id)).rejects.toThrow();
    await expect(environment.services.fs.stat(emptySecond.id)).rejects.toThrow();
  } finally {
    environment.dispose();
  }
});
