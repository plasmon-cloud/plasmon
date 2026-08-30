import { expect, test } from "bun:test";
import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import {
  SYSTEM_APP_MIME,
  shortcutMetadata,
  systemAppMetadata,
} from "../fs/index.ts";
import {
  canDropNodesToRecycleBin,
  isRecycleBinDropTarget,
  moveDroppedNodesToRecycleBin,
} from "./trash-drop.ts";

function node(
  id: NodeId,
  name: string,
  kind: FsNode["kind"],
  options: Partial<Pick<FsNode, "mime" | "metadata">> = {},
): FsNode {
  return {
    id,
    parentId: "parent",
    name,
    kind,
    size: kind === "directory" ? 0 : 1,
    createdAt: 1,
    modifiedAt: 1,
    metadata: options.metadata ?? {},
    ...(options.mime ? { mime: options.mime } : {}),
  };
}

test("Recycle Bin drop target uses canonical app identity rather than its display name", async () => {
  const recycleBin = node("recycle-bin-app", "RecycleBin.sys", "file", {
    mime: SYSTEM_APP_MIME,
    metadata: systemAppMetadata("native:recycle-bin", "native:recycle-bin"),
  });
  const shortcut = node("recycle-bin-shortcut", "Recycle Bin", "shortcut", {
    metadata: shortcutMetadata({ kind: "node", nodeId: recycleBin.id }, "system-required"),
  });
  const counterfeit = node("counterfeit", "Recycle Bin", "shortcut", {
    metadata: shortcutMetadata({ kind: "node", nodeId: "ordinary-file" }),
  });
  const fs = {
    async stat(id: NodeId) {
      if (id === recycleBin.id) return recycleBin;
      if (id === "ordinary-file") return node("ordinary-file", "RecycleBin.sys", "file");
      throw new Error("missing");
    },
  } as unknown as FsService;

  expect(await isRecycleBinDropTarget(fs, recycleBin)).toBe(true);
  expect(await isRecycleBinDropTarget(fs, shortcut)).toBe(true);
  expect(await isRecycleBinDropTarget(fs, counterfeit)).toBe(false);
});

test("Recycle Bin drop eligibility follows canonical resource delete capabilities", () => {
  const file = node("file", "notes.txt", "file");
  const folder = node("folder", "Drafts", "directory");
  const shortcut = node("shortcut", "Notes", "shortcut", {
    metadata: shortcutMetadata({ kind: "node", nodeId: file.id }),
  });
  const protectedApp = node("settings", "Settings.sys", "file", {
    mime: SYSTEM_APP_MIME,
    metadata: systemAppMetadata("native:settings", "native:settings"),
  });

  expect(canDropNodesToRecycleBin([file, folder, shortcut])).toBe(true);
  expect(canDropNodesToRecycleBin([file, protectedApp])).toBe(false);
  expect(canDropNodesToRecycleBin([])).toBe(false);
});

test("Recycle Bin drop delegates every resource to the existing Trash authority", async () => {
  const first = node("first", "first.txt", "file");
  const second = node("second", "second.txt", "file");
  const calls: NodeId[] = [];
  const result = await moveDroppedNodesToRecycleBin({
    async trash(id) {
      calls.push(id);
      if (id === second.id) throw new Error("protected");
    },
  }, [first, second]);

  expect(calls).toEqual([first.id, second.id]);
  expect(result.deletedIds).toEqual([first.id]);
  expect(result.failures).toEqual([{ nodeId: second.id, name: second.name, message: "protected" }]);
});
