import { expect, test } from "bun:test";
import type { FsEvent, FsNode } from "../../../src/os/contracts/index.ts";
import { isFsEventRelevant, reconcileSelection, type SelectionState } from "../../../src/os/file-manager/model.ts";

/**
 * Issue #195 characterization guards.
 *
 * The accepted FileManager command and interaction outcomes are already
 * covered by the owning focused/headless/RTL suites indexed in the companion
 * packet. This small uncovered refresh-boundary guard protects a seam that a
 * renderer decomposition must retain: filesystem invalidations decide when
 * the adapter re-reads authoritative directory state, never when it invents
 * local resource state.
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

test("#195 characterization keeps refresh relevance at the directory authority boundary", () => {
  const directoryId = "directory";
  const child = node("child", directoryId);
  const unrelated = node("unrelated", "other-directory");

  const events: FsEvent[] = [
    { type: "created", node: child },
    { type: "changed", node: child },
    { type: "moved", node: child, oldParentId: "old-directory" },
    { type: "moved", node: { ...child, parentId: "other-directory" }, oldParentId: directoryId },
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
  expect(isFsEventRelevant({ type: "changed", node: unrelated }, directoryId)).toBe(false);
  expect(isFsEventRelevant({ type: "removed", id: "gone", parentId: "other-directory" }, directoryId)).toBe(false);
});

test("#195 characterization reconciles selection by stable NodeId after authoritative refresh", () => {
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
