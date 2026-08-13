import { describe, expect, test } from "bun:test";
import { deriveFileEntryRenderState } from "./file-entry-state.ts";

describe("FileEntry deterministic rendered state", () => {
  test("keeps rename targeting keyed to NodeId", () => {
    const matching = deriveFileEntryRenderState({
      nodeId: "node-a",
      selected: true,
      focused: true,
      dropTarget: false,
      presentation: "desktop",
      position: { x: 16, y: 24 },
      renameNodeId: "node-a",
    });
    expect(matching.isRenaming).toBe(true);
    expect(matching.className).toContain("is-renaming");
    expect(matching.showExpandedName).toBe(false);
    expect(matching.showCollapsedNameTitle).toBe(false);

    const otherNode = deriveFileEntryRenderState({
      nodeId: "node-a",
      selected: true,
      focused: true,
      dropTarget: false,
      presentation: "desktop",
      position: { x: 16, y: 24 },
      renameNodeId: "node-b",
    });
    expect(otherNode.isRenaming).toBe(false);
    expect(otherNode.showExpandedName).toBe(true);
  });

  test("derives desktop placement without making the rendered entry layout authority", () => {
    const state = deriveFileEntryRenderState({
      nodeId: "node-a",
      selected: false,
      focused: false,
      dropTarget: true,
      presentation: "desktop",
      position: { x: 31, y: 47 },
      renameNodeId: null,
    });
    expect(state.style).toEqual({ left: 31, top: 47 });
    expect(state.className).toBe("fm-entry fm-entry--desktop is-drop-target");
    expect(state.showCollapsedNameTitle).toBe(true);
  });

  test("does not manufacture absolute placement for non-Desktop presentations", () => {
    const state = deriveFileEntryRenderState({
      nodeId: "node-a",
      selected: true,
      focused: false,
      dropTarget: false,
      presentation: "grid",
      position: { x: 31, y: 47 },
      renameNodeId: null,
    });
    expect(state.style).toBeUndefined();
    expect(state.showExpandedName).toBe(false);
    expect(state.className).toBe("fm-entry fm-entry--grid is-selected");
  });
});
