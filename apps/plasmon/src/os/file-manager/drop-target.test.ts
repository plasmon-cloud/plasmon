import { expect, test } from "bun:test";
import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { directoryDropCandidateId } from "./drop-target.ts";
import { moveNodesToDirectory } from "./model.ts";

function node(id: NodeId, parentId: NodeId | null, name: string, kind: FsNode["kind"]): FsNode {
  return {
    id,
    parentId,
    name,
    kind,
    size: kind === "directory" ? 0 : 1,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
    ...(kind === "file" ? { mime: "text/plain", contentHash: `hash-${id}` } : {}),
  };
}

test("another FileManager directory entry can be a drop candidate", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "documents", nodeKind: "directory" },
  ], ["source-file"])).toBe("documents");
});

test("an open FileManager content surface exposes its current directory", () => {
  expect(directoryDropCandidateId([
    { kind: "surface", directoryId: "documents" },
  ], ["source-file"])).toBe("documents");
});

test("a normal file entry blocks the containing directory surface", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "other-file", nodeKind: "file" },
    { kind: "surface", directoryId: "documents" },
  ], ["source-file"])).toBeNull();
});

test("a dragged directory cannot target itself through entry or surface hits", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "dragged-folder", nodeKind: "directory" },
  ], ["dragged-folder"])).toBeNull();
  expect(directoryDropCandidateId([
    { kind: "surface", directoryId: "dragged-folder" },
  ], ["dragged-folder"])).toBeNull();
});

test("canonical directory drop invokes FsService.move for every selected resource", async () => {
  const documents = node("documents", "root", "Documents", "directory");
  const first = node("first", "desktop", "first.txt", "file");
  const second = node("second", "desktop", "second.txt", "file");
  const calls: Array<{ id: NodeId; target: NodeId }> = [];
  const fs = {
    async move(id: NodeId, target: NodeId) {
      calls.push({ id, target });
      const source = id === first.id ? first : second;
      return { ...source, parentId: target };
    },
  } as unknown as FsService;

  const moved = await moveNodesToDirectory(fs, [first, second], documents);

  expect(calls).toEqual([
    { id: first.id, target: documents.id },
    { id: second.id, target: documents.id },
  ]);
  expect(moved.map((entry) => entry.id)).toEqual([first.id, second.id]);
  expect(moved.every((entry) => entry.parentId === documents.id)).toBe(true);
});
