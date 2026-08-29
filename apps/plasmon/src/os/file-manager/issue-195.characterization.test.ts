import { expect, test } from "bun:test";
import type { FsEvent, FsNode } from "../contracts/index.ts";
import { isFsEventRelevant, reconcileSelection, type SelectionState } from "./model.ts";

/**
 * Adopted from Luna-A's validated #195 characterization packet.
 *
 * These guards protect the refresh boundary that the FileManager browser/render
 * decomposition must preserve: filesystem events decide when the adapter
 * re-reads authoritative directory state, and selection is reconciled by stable
 * NodeId after that authoritative refresh.
 */
function node(id: string, parentId: string, name = id): FsNode {
  return {
    id,
    parentId,
    name,
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test("keeps displayed-directory refresh relevance at the filesystem event boundary", () => {
  const directoryId = "directory";
  const child = node("child", directoryId);
  const unrelated = node("unrelated", "other-directory");

  const events: FsEvent[] = [
    { type: "created", node: child },
    { type: "changed", node: child },
    { type: "moved", node: child, oldParentId: "old-directory" },
    {
      type: "moved",
      node: { ...child, parentId: "other-directory" },
      oldParentId: directoryId,
    },
    { type: "removed", id: child.id, parentId: directoryId },
    { type: "reset", revision: 2 },
  ];

  expect(events.map((event) => isFsEventRelevant(event, directoryId))).toEqual([
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  expect(
    isFsEventRelevant({ type: "changed", node: unrelated }, directoryId),
  ).toBe(false);
  expect(
    isFsEventRelevant(
      { type: "removed", id: "gone", parentId: "other-directory" },
      directoryId,
    ),
  ).toBe(false);
});

test("reconciles selection by stable NodeId after authoritative refresh", () => {
  const current: SelectionState = {
    ids: new Set(["kept", "removed"]),
    anchor: "kept",
    focus: "removed",
  };

  expect(reconcileSelection(current, new Set(["kept", "new"]))).toEqual({
    ids: new Set(["kept"]),
    anchor: "kept",
    focus: null,
  });
});
