import { describe, expect, test } from "bun:test";
import { deriveFileEntryRenderState } from "./file-entry-state.ts";

const base = {
  nodeId: "node-a",
  selected: false,
  focused: false,
  dropTarget: false,
  presentation: "desktop" as const,
  position: { x: 31, y: 47 },
  renameNodeId: null,
};

describe("FileEntry deterministic rendered state", () => {
  test("keys rename presentation to NodeId", () => {
    const state = deriveFileEntryRenderState({ ...base, selected: true, focused: true, renameNodeId: "node-a" });
    expect(state.isRenaming).toBe(true);
    expect(state.className).toContain("is-renaming");
    expect(state.showExpandedName).toBe(false);
  });

  test("renders controller coordinates and label anchor without allocating placement", () => {
    const state = deriveFileEntryRenderState({ ...base, dropTarget: true });
    expect(state.style).toEqual({ left: 31, top: 47, "--fm-desktop-entry-x": "31px" });
    expect(state.className).toBe("fm-entry fm-entry--desktop is-drop-target");
    expect(state.showCollapsedNameTitle).toBe(true);
  });

  test("does not apply Desktop coordinates to another presentation", () => {
    const state = deriveFileEntryRenderState({ ...base, presentation: "grid", selected: true });
    expect(state.style).toBeUndefined();
    expect(state.showExpandedName).toBe(false);
  });
});
