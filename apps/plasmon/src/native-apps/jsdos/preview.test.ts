import { expect, test } from "bun:test";
import { boundedPreviewDimensions } from "./preview.ts";

test("#124 preview dimensions preserve aspect ratio inside the bounded frame", () => {
  expect(boundedPreviewDimensions(640, 400)).toEqual({ width: 320, height: 200 });
  expect(boundedPreviewDimensions(1920, 1080)).toEqual({ width: 320, height: 180 });
  expect(boundedPreviewDimensions(100, 50)).toEqual({ width: 100, height: 50 });
});

test("#124 invalid canvas dimensions decline capture instead of affecting save state", () => {
  expect(boundedPreviewDimensions(0, 200)).toBeNull();
  expect(boundedPreviewDimensions(Number.NaN, 200)).toBeNull();
  expect(boundedPreviewDimensions(320, -1)).toBeNull();
});
