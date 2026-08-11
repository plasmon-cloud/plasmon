import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { repositionDesktopNodes } from "./Desktop.tsx";
import { allocateDesktopPositions } from "./layout.ts";

function node(id: string, name: string): FsNode {
  return {
    id,
    parentId: "desktop",
    name,
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test("a just-created Desktop node drags from its allocated free slot before persistence completes", () => {
  const nodes = [node("existing", "Existing"), node("new", "New Text Document.txt")];
  const persisted = { existing: { x: 16, y: 16 } };
  const allocated = allocateDesktopPositions(persisted, nodes);
  const origin = allocated.new;
  expect(origin).toBeDefined();

  const moved = repositionDesktopNodes(allocated, nodes, ["new"], { dx: 20, dy: 10 }, { width: 1000, height: 700 });
  expect(moved.new).toEqual({ x: origin!.x + 20, y: origin!.y + 10 });
  expect(moved.existing).toEqual(persisted.existing);
});
