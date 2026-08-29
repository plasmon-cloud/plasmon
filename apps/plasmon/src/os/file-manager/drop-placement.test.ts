import { expect, test } from "bun:test";
import {
  dispatchIncomingDropPlacement,
  FILE_MANAGER_INCOMING_DROP_PLACEMENT_EVENT,
  incomingDropPlacementIntent,
  type IncomingDropPlacementRequest,
} from "./drop-placement.ts";

test("incoming placement preserves the translated ghost top-left in target coordinates", () => {
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

test("grouped incoming placement keeps each stable NodeId and relative source geometry", () => {
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

test("target placement is only committed when the successful move invokes its deferred commit", async () => {
  const intent = incomingDropPlacementIntent([
    { id: "file-a", left: 100, top: 80, width: 92, height: 88 },
  ], { dx: 40, dy: 50 }, {
    left: 10,
    top: 20,
    width: 800,
    height: 600,
  });
  const target = new EventTarget();
  let commitCalls = 0;

  target.addEventListener(FILE_MANAGER_INCOMING_DROP_PLACEMENT_EVENT, (event) => {
    const request = (event as CustomEvent<IncomingDropPlacementRequest>).detail;
    request.commit = async () => { commitCalls += 1; };
    event.preventDefault();
  });

  const commit = dispatchIncomingDropPlacement(target, intent);
  expect(commit).not.toBeNull();
  expect(commitCalls).toBe(0);

  await commit?.();
  expect(commitCalls).toBe(1);
});
