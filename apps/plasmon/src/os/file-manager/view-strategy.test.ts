// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { NodeId } from "../contracts/index.ts";
import {
  fileManagerViewStrategy,
  nextFileManagerViewId,
} from "./view-strategy.ts";

const id = (value: string) => value as NodeId;
const a = id("a");
const b = id("b");
const c = id("c");
const d = id("d");
const ordered = [a, b, c, d];
const rectangles = new Map([
  [a, { left: 0, top: 0, right: 180, bottom: 36 }],
  [b, { left: 190, top: 0, right: 370, bottom: 36 }],
  [c, { left: 0, top: 40, right: 180, bottom: 76 }],
  [d, { left: 190, top: 40, right: 370, bottom: 76 }],
]);

test("#196 exposes explicit Grid, List, and Details strategies", () => {
  expect(fileManagerViewStrategy("grid")).toEqual({
    kind: "grid",
    entryPresentation: "grid",
    navigation: "spatial",
    detailsColumns: null,
  });
  expect(fileManagerViewStrategy("list")).toEqual({
    kind: "list",
    entryPresentation: "list",
    navigation: "spatial",
    detailsColumns: null,
  });
  expect(fileManagerViewStrategy("details")).toEqual({
    kind: "details",
    entryPresentation: "details",
    navigation: "linear",
    detailsColumns: ["Name", "Type", "Size", "Modified"],
  });
  expect(fileManagerViewStrategy("desktop")).toBeNull();
});

test("#196 Grid and List strategies follow rendered geometry", () => {
  for (const presentation of ["grid", "list"] as const) {
    expect(nextFileManagerViewId({
      presentation,
      orderedIds: ordered,
      currentId: a,
      direction: "right",
      rectangles,
    })).toBe(b);
    expect(nextFileManagerViewId({
      presentation,
      orderedIds: ordered,
      currentId: a,
      direction: "down",
      rectangles,
    })).toBe(c);
    expect(nextFileManagerViewId({
      presentation,
      orderedIds: ordered,
      currentId: a,
      direction: "left",
      rectangles,
    })).toBeNull();
  }
});

test("#196 Details keeps stable ordered NodeId row navigation", () => {
  expect(nextFileManagerViewId({
    presentation: "details",
    orderedIds: ordered,
    currentId: b,
    direction: "right",
    rectangles,
  })).toBe(c);
  expect(nextFileManagerViewId({
    presentation: "details",
    orderedIds: ordered,
    currentId: b,
    direction: "left",
    rectangles,
  })).toBe(a);
});
