import { describe, expect, test } from "bun:test";
import { fitContextMenuPosition } from "./context-menu-position.ts";

describe("fitContextMenuPosition", () => {
  test("preserves an anchor that already fits inside the owning surface", () => {
    expect(fitContextMenuPosition(
      { x: 160, y: 120 },
      { width: 220, height: 320 },
      { left: 0, top: 0, right: 1000, bottom: 664 },
    )).toEqual({ x: 160, y: 120 });
  });

  test("moves a lower-right menu above the taskbar-facing edge", () => {
    expect(fitContextMenuPosition(
      { x: 920, y: 620 },
      { width: 220, height: 350 },
      { left: 0, top: 0, right: 1000, bottom: 664 },
    )).toEqual({ x: 776, y: 310 });
  });

  test("respects non-zero Explorer surface bounds", () => {
    expect(fitContextMenuPosition(
      { x: 790, y: 590 },
      { width: 240, height: 300 },
      { left: 120, top: 90, right: 820, bottom: 610 },
    )).toEqual({ x: 576, y: 306 });
  });
});
