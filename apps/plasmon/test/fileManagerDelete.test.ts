import { expect, test } from "bun:test";
import type { ExternalElement, FsNode } from "../src/os/contracts/index.ts";
import {
  deleteFailureMessage,
  deleteFilesystemNodes,
} from "../src/os/file-manager/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const TRASH_DEMO_ELEMENT: ExternalElement = {
  id: "trash-demo",
  name: "Trash Demo",
  description: "Headless FileManager Trash policy fixture.",
  version: 1,
  tiles: [{ id: "main", title: "Trash Demo" }],
  running: "no",
};

function requireDirectory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

test("ordinary FileManager Delete moves files and folders through canonical Trash and preserves stable identity", async () => {
  const environment = createHeadlessPlasmonEnvironment();

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const note = await environment.services.fs.createFile(documents.id, "trash-note.txt", {
      mime: "text/plain",
    });
    const folder = await environment.services.fs.mkdir(documents.id, "Trash Folder");
    const child = await environment.services.fs.createFile(folder.id, "child.txt", {
      mime: "text/plain",
    });

    const result = await deleteFilesystemNodes(
      environment.services.filesystem.trash,
      [note, folder],
    );

    expect(result.deletedIds).toEqual([note.id, folder.id]);
    expect(result.failures).toEqual([]);
    expect(await environment.node("/Documents/trash-note.txt")).toBeNull();
    expect(await environment.node("/Documents/Trash Folder")).toBeNull();

    const entries = await environment.services.filesystem.trash.list();
    const noteEntry = entries.find((entry) => entry.node.id === note.id);
    const folderEntry = entries.find((entry) => entry.node.id === folder.id);
    expect(noteEntry?.node.id).toBe(note.id);
    expect(noteEntry?.originalParentId).toBe(documents.id);
    expect(noteEntry?.originalName).toBe("trash-note.txt");
    expect(noteEntry?.originalPath).toBe("/Documents/trash-note.txt");
    expect(folderEntry?.node.id).toBe(folder.id);
    expect(folderEntry?.originalParentId).toBe(documents.id);
    expect(folderEntry?.originalName).toBe("Trash Folder");
    expect(folderEntry?.originalPath).toBe("/Documents/Trash Folder");
    expect((await environment.services.fs.stat(child.id)).id).toBe(child.id);

    const restoredNote = await environment.services.filesystem.trash.restore(note.id);
    const restoredFolder = await environment.services.filesystem.trash.restore(folder.id);
    expect(restoredNote.node.id).toBe(note.id);
    expect(restoredFolder.node.id).toBe(folder.id);
    expect((await environment.node("/Documents/trash-note.txt"))?.id).toBe(note.id);
    expect((await environment.node("/Documents/Trash Folder"))?.id).toBe(folder.id);
    expect((await environment.node("/Documents/Trash Folder/child.txt"))?.id).toBe(child.id);
  } finally {
    environment.dispose();
  }
});

test("multi-selection continues after protected failures and preserves canonical policy errors", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [TRASH_DEMO_ELEMENT] });

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const ordinary = await environment.services.fs.createFile(documents.id, "deletable.txt", {
      mime: "text/plain",
    });
    const photos = await environment.node("/System/Photos.sys");
    const neutronApp = await environment.node("/Apps/Trash Demo.neutron");
    if (!photos) throw new Error("Photos.sys is unavailable");
    if (!neutronApp) throw new Error("Trash Demo.neutron projection is unavailable");

    const result = await deleteFilesystemNodes(
      environment.services.filesystem.trash,
      [photos, ordinary, neutronApp],
    );

    expect(result.deletedIds).toEqual([ordinary.id]);
    expect(result.failures.map((failure) => failure.nodeId)).toEqual([photos.id, neutronApp.id]);
    expect(result.failures[0]?.message).toBe("Photos.sys is protected and cannot be deleted");
    expect(result.failures[1]?.message).toBe("Trash Demo.neutron is an installed application; use Uninstall instead");
    expect(deleteFailureMessage(result.failures)).toBe(
      "2 items could not be moved to Recycle Bin — Photos.sys: Photos.sys is protected and cannot be deleted; Trash Demo.neutron: Trash Demo.neutron is an installed application; use Uninstall instead",
    );

    expect(await environment.node("/Documents/deletable.txt")).toBeNull();
    expect((await environment.node("/System/Photos.sys"))?.id).toBe(photos.id);
    expect((await environment.node("/Apps/Trash Demo.neutron"))?.id).toBe(neutronApp.id);
    expect((await environment.services.filesystem.trash.list()).some((entry) => entry.node.id === ordinary.id)).toBe(true);

    expect(deleteFailureMessage([result.failures[0]!])).toBe(
      "Photos.sys is protected and cannot be deleted",
    );
  } finally {
    environment.dispose();
  }
});
