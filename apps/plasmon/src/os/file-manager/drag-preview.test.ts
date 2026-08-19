// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { dragOperationFeedback, translatedDragPreviewRect } from "./drag-preview.ts";

test("#360 drag preview preserves source size and applies the exact drag delta", () => {
  expect(translatedDragPreviewRect(
    { left: 120, top: 80, width: 92, height: 88 },
    { dx: 137, dy: 64 },
  )).toEqual({ left: 257, top: 144, width: 92, height: 88 });
});

test("#360 drag feedback describes the canonical operation and destination", () => {
  expect(dragOperationFeedback("move", "New folder")).toBe("Move to New folder");
  expect(dragOperationFeedback("copy", "Archive")).toBe("Copy to Archive");
  expect(dragOperationFeedback("move", null)).toBeNull();
});
