import { expect, test } from "bun:test";
import { incomingDropPlacementIntent } from "./drop-placement.ts";

test("#371 incoming placement preserves the translated ghost top-left in target coordinates", () => {
  const intent = incomingDropPlacementIntent([
    { id: "file-a", left: 420, top: 180, width: 128, height: 94 },
  ], { dx: 215, dy: 307 }, {
    left: 32,
    top: 24,
    width: 1200,
    height: 760,
  });

  expect(intent).toEqual({
    placements: [{ id: "file-a", x: 603, y: 463 }],
    workspace: { width: 1200, height: 760 },
  });
});

test("#371 grouped incoming placement keeps each stable NodeId and relative source geometry", () => {
  const intent = incomingDropPlacementIntent([
    { id: "a", left: 300, top: 100, width: 104, height: 94 },
    { id: "b", left: 300, top: 204, width: 104, height: 94 },
  ], { dx: 500, dy: 80 }, {
    left: 20,
    top: 10,
    width: 1400,
    height: 800,
  });

  expect(intent.placements).toEqual([
    { id: "a", x: 780, y: 170 },
    { id: "b", x: 780, y: 274 },
  ]);
});
