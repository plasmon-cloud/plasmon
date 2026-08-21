// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { NodeId } from "../contracts/index.ts";
import { spatialNeighborId, type SpatialRect } from "./spatial-navigation.ts";

const id = (value: string) => value as NodeId;
const a = id("a");
const b = id("b");
const c = id("c");
const d = id("d");
const ordered = [a, b, c, d];
const rectangles = new Map<NodeId, SpatialRect>([
  [a, { left: 0, top: 0, right: 180, bottom: 36 }],
  [b, { left: 190, top: 0, right: 370, bottom: 36 }],
  [c, { left: 0, top: 40, right: 180, bottom: 76 }],
  [d, { left: 190, top: 40, right: 370, bottom: 76 }],
]);

test("#173 spatial navigation follows rendered rows and columns", () => {
  expect(spatialNeighborId(ordered, a, "right", rectangles)).toBe(b);
  expect(spatialNeighborId(ordered, a, "down", rectangles)).toBe(c);
  expect(spatialNeighborId(ordered, d, "left", rectangles)).toBe(c);
  expect(spatialNeighborId(ordered, d, "up", rectangles)).toBe(b);
});

test("#173 spatial navigation stays put when no candidate exists", () => {
  expect(spatialNeighborId(ordered, a, "left", rectangles)).toBeNull();
  expect(spatialNeighborId(ordered, d, "right", rectangles)).toBeNull();
});

test("#173 spatial navigation uses stable order to break equal geometry ties", () => {
  const e = id("e");
  const f = id("f");
  const tied = new Map<NodeId, SpatialRect>([
    [a, { left: 0, top: 0, right: 100, bottom: 30 }],
    [e, { left: 120, top: 0, right: 220, bottom: 30 }],
    [f, { left: 120, top: 0, right: 220, bottom: 30 }],
  ]);
  expect(spatialNeighborId([a, e, f], a, "right", tied)).toBe(e);
});
