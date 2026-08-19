import { expect, test } from "bun:test";
import { directoryDropCandidateId } from "./drop-target.ts";

test("#360 another FileManager directory entry can be a drop candidate", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "documents", nodeKind: "directory" },
  ], ["source-file"])).toBe("documents");
});

test("#360 an open FileManager content surface exposes its current directory", () => {
  expect(directoryDropCandidateId([
    { kind: "surface", directoryId: "documents" },
  ], ["source-file"])).toBe("documents");
});

test("#360 a normal file entry blocks the containing directory surface", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "other-file", nodeKind: "file" },
    { kind: "surface", directoryId: "documents" },
  ], ["source-file"])).toBeNull();
});

test("#360 a dragged directory cannot target itself through entry or surface hits", () => {
  expect(directoryDropCandidateId([
    { kind: "entry", nodeId: "dragged-folder", nodeKind: "directory" },
  ], ["dragged-folder"])).toBeNull();
  expect(directoryDropCandidateId([
    { kind: "surface", directoryId: "dragged-folder" },
  ], ["dragged-folder"])).toBeNull();
});
