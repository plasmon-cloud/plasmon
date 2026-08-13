import { expect, test } from "bun:test";
import { reconcileDesktopPositions } from "./layout.ts";

/**
 * Issue #192 corrective gates adopted from Luna TDD-A `e56b246`.
 * Assertions are unchanged; the test now targets the production NodeId-only
 * placement authority directly.
 */

const workspace = { width: 640, height: 480 };

test("#192 RED — restored/new resources avoid an occupied persisted Desktop slot", () => {
  const positions = {
    existing: { x: 16, y: 16 },
    restored: { x: 16, y: 16 },
  };

  const reconciled = reconcileDesktopPositions(positions, ["existing", "restored"], workspace);

  expect(reconciled.existing).toEqual(positions.existing);
  expect(reconciled.restored).not.toEqual(reconciled.existing);
});

test("#192 RED — invalid persisted Desktop coordinates are repaired into the usable workspace", () => {
  const positions = { outside: { x: -40, y: -12 } };

  const reconciled = reconcileDesktopPositions(positions, ["outside"], workspace);

  expect(reconciled.outside.x).toBeGreaterThanOrEqual(0);
  expect(reconciled.outside.y).toBeGreaterThanOrEqual(0);
});

test("#192 RED — a restore collision does not move an unrelated valid resource", () => {
  const positions = {
    unrelated: { x: 120, y: 16 },
    restored: { x: 120, y: 16 },
  };

  const reconciled = reconcileDesktopPositions(positions, ["unrelated", "restored"], workspace);

  expect(reconciled.unrelated).toEqual(positions.unrelated);
  expect(reconciled.restored).not.toEqual(reconciled.unrelated);
});
