// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { boundedDragGeometry } from "./interaction.ts";

test("oversized active drag can expose right-side controls while preserving reachable titlebar bounds", () => {
  const viewport = { x: 0, y: 0, width: 500, height: 360 };
  const start = { x: 0, y: 20, width: 640, height: 300 };
  const constraints = {
    minWidth: 640,
    minHeight: 300,
    reachableTitlebarWidth: 72,
    reachableTitlebarHeight: 32,
  };

  const exposingControls = boundedDragGeometry(start, -180, 0, viewport, constraints);
  expect(exposingControls).toEqual({ ...start, x: -180, y: 20 });
  expect(exposingControls.x + exposingControls.width).toBeLessThanOrEqual(viewport.width);

  const extreme = boundedDragGeometry(start, -1000, 0, viewport, constraints);
  expect(extreme.x).toBe(-568);
  expect(extreme.x + extreme.width).toBe(72);
});
