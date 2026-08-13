import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { allocateDesktopPositions } from "./layout.ts";

/**
 * Issue #192 intentional RED gates adopted from Luna TDD-A `e56b246`.
 *
 * Existing focused Desktop tests remain characterization guards for valid
 * persisted NodeId positions and deterministic first allocation. These gates
 * exercise the missing reconciliation behavior without changing filesystem or
 * Trash authority.
 */

function node(id: string): FsNode {
  return {
    id,
    parentId: "desktop",
    name: id,
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test("#192 RED — restored/new resources avoid an occupied persisted Desktop slot", () => {
  const nodes = [node("existing"), node("restored")];
  const positions = {
    existing: { x: 16, y: 16 },
    restored: { x: 16, y: 16 },
  };

  const reconciled = allocateDesktopPositions(positions, nodes);

  expect(reconciled.existing).toEqual(positions.existing);
  expect(reconciled.restored).not.toEqual(reconciled.existing);
});

test("#192 RED — invalid persisted Desktop coordinates are repaired into the usable workspace", () => {
  const nodes = [node("outside")];
  const positions = { outside: { x: -40, y: -12 } };

  const reconciled = allocateDesktopPositions(positions, nodes);

  expect(reconciled.outside.x).toBeGreaterThanOrEqual(0);
  expect(reconciled.outside.y).toBeGreaterThanOrEqual(0);
});

test("#192 RED — a restore collision does not move an unrelated valid resource", () => {
  const nodes = [node("unrelated"), node("restored")];
  const positions = {
    unrelated: { x: 120, y: 16 },
    restored: { x: 120, y: 16 },
  };

  const reconciled = allocateDesktopPositions(positions, nodes);

  expect(reconciled.unrelated).toEqual(positions.unrelated);
  expect(reconciled.restored).not.toEqual(reconciled.unrelated);
});
