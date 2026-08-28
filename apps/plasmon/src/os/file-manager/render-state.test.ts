import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { emptySelection, selectNode } from "./model.ts";
import { deriveFileManagerRenderState } from "./render-state.ts";

function node(id: string, name: string): FsNode {
  return {
    id,
    parentId: "folder",
    name,
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test("#195 derives filtered render order without changing NodeId selection", () => {
  const nodes = [node("alpha", "Alpha.txt"), node("beta", "Beta.md")];
  const selection = selectNode(emptySelection(), nodes.map((entry) => entry.id), "beta");

  const state = deriveFileManagerRenderState({
    nodes,
    selection,
    filterQuery: " beta ",
    presentation: "grid",
  });

  expect(state.visibleNodes.map((entry) => entry.id)).toEqual(["beta"]);
  expect(state.orderedIds).toEqual(["beta"]);
  expect(state.snapshot.selectedIds).toEqual(new Set(["beta"]));
  expect(state.desktopPositions).toEqual({});
});

test("#195 passes caller-owned Desktop coordinates through only for Desktop presentation", () => {
  const nodes = [node("alpha", "Alpha.txt")];
  const selection = emptySelection();
  const positions = { alpha: { x: 16, y: 24 } };

  expect(deriveFileManagerRenderState({
    nodes,
    selection,
    filterQuery: "",
    presentation: "desktop",
    positions,
  }).desktopPositions).toBe(positions);

  expect(deriveFileManagerRenderState({
    nodes,
    selection,
    filterQuery: "",
    presentation: "details",
    positions,
  }).desktopPositions).toEqual({});
});
