// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { dragOperationFeedback, translatedDragPreviewRect } from "./drag-preview.ts";

test("#360 drag preview preserves source size and applies the exact drag delta", () => {
  expect(translatedDragPreviewRect(
    { left: 120, top: 80, width: 92, height: 88 },
    { dx: 137, dy: 64 },
  )).toEqual({ left: 257, top: 144, width: 92, height: 88 });
});

test("#360 drag preview keeps the same entry geometry for an off-center pointer grab", () => {
  const source = { left: 44, top: 71, width: 92, height: 88 };
  const pointerGrab = { x: 19, y: 23 };
  const delta = { dx: 51, dy: -17 };
  const preview = translatedDragPreviewRect(source, delta);
  const movedPointer = {
    x: source.left + pointerGrab.x + delta.dx,
    y: source.top + pointerGrab.y + delta.dy,
  };

  expect(movedPointer.x - preview.left).toBe(pointerGrab.x);
  expect(movedPointer.y - preview.top).toBe(pointerGrab.y);
  expect(preview.width).toBe(source.width);
  expect(preview.height).toBe(source.height);
});

test("#360 drag feedback describes the canonical operation and destination", () => {
  expect(dragOperationFeedback("move", "New folder")).toBe("Move to New folder");
  expect(dragOperationFeedback("copy", "Archive")).toBe("Copy to Archive");
  expect(dragOperationFeedback("move", null)).toBeNull();
});

test("#360 drag feedback follows target changes and clears when no target is active", () => {
  const feedback = [
    dragOperationFeedback("move", "Documents"),
    dragOperationFeedback("move", "Games"),
    dragOperationFeedback("move", null),
  ];

  expect(feedback).toEqual([
    "Move to Documents",
    "Move to Games",
    null,
  ]);
});
