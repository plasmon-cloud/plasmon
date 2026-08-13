import { expect, test } from "bun:test";
import {
  applyDesktopDragDelta,
  reconcileDesktopPositions,
} from "./layout.ts";

const workspace = { width: 640, height: 480 };

test("a just-created Desktop node drags from its allocated free slot before persistence completes", () => {
  const ids = ["existing", "new"];
  const persisted = { existing: { x: 16, y: 16 } };
  const allocated = reconcileDesktopPositions(persisted, ids, workspace);
  const origin = allocated.new;
  expect(origin).toBeDefined();

  const moved = applyDesktopDragDelta(allocated, ids, ["new"], { dx: 20, dy: 10 }, workspace);
  expect(moved.new).toEqual({ x: origin!.x + 20, y: origin!.y + 10 });
  expect(moved.existing).toEqual(persisted.existing);
});

test("valid explicit Desktop positions survive recomposition without unrelated movement", () => {
  const persisted = {
    a: { x: 224, y: 120 },
    b: { x: 16, y: 16 },
  };

  expect(reconcileDesktopPositions(persisted, ["a", "b"], workspace)).toEqual(persisted);
  expect(reconcileDesktopPositions(persisted, ["b", "a"], workspace)).toEqual(persisted);
});

test("workspace shrink repairs only entries that no longer fit", () => {
  const persisted = {
    stable: { x: 16, y: 16 },
    outside: { x: 536, y: 328 },
  };
  const smaller = { width: 360, height: 300 };

  const reconciled = reconcileDesktopPositions(persisted, ["stable", "outside"], smaller);

  expect(reconciled.stable).toEqual(persisted.stable);
  expect(reconciled.outside).not.toEqual(persisted.outside);
  expect(reconciled.outside.x).toBeGreaterThanOrEqual(0);
  expect(reconciled.outside.x).toBeLessThanOrEqual(smaller.width - 92);
  expect(reconciled.outside.y).toBeGreaterThanOrEqual(0);
  expect(reconciled.outside.y).toBeLessThanOrEqual(smaller.height - 88);
  expect(reconcileDesktopPositions(reconciled, ["stable", "outside"], smaller)).toEqual(reconciled);
});

test("inactive persisted positions do not reserve visible slots", () => {
  const persisted = { trashed: { x: 16, y: 16 } };
  const reconciled = reconcileDesktopPositions(persisted, ["visible"], workspace);

  expect(reconciled.trashed).toEqual(persisted.trashed);
  expect(reconciled.visible).toEqual({ x: 16, y: 16 });
});
