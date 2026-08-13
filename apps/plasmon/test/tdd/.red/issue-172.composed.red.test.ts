import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { allocateDesktopPositions } from "../../../src/os/desktop/layout.ts";

function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x < b.x + 92 && a.x + 92 > b.x && a.y < b.y + 88 && a.y + 88 > b.y;
}

test("#172 composed regression — Trash restore collision preserves NodeIds and incumbent placement", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const desktop = await environment.node("/Desktop");
    if (!desktop) throw new Error("Desktop bootstrap missing");
    const original = await environment.services.fs.createFile(desktop.id, "restore-me.txt", { mime: "text/plain" });
    const originalPosition = { x: 16, y: 16 };
    const occupant = await environment.services.fs.createFile(desktop.id, "occupant.txt", { mime: "text/plain" });
    const positions = { [original.id]: originalPosition, [occupant.id]: originalPosition };
    const trashed = await environment.services.filesystem.trash.trash(original.id);
    const incumbent = await environment.services.fs.stat(occupant.id);
    const restored = await environment.services.filesystem.trash.restore(trashed.node.id, "/Desktop");
    expect(restored.node.id).toBe(original.id);
    expect(await environment.services.fs.stat(occupant.id)).toEqual(incumbent);

    const visible = [incumbent, restored.node];
    const reconciled = allocateDesktopPositions(positions, visible);
    expect(reconciled[occupant.id]).toEqual(originalPosition);
    expect(reconciled[restored.node.id]).toBeDefined();
    expect(overlaps(reconciled[occupant.id]!, reconciled[restored.node.id]!)).toBe(false);
    expect(allocateDesktopPositions(reconciled, visible)).toEqual(reconciled);
  } finally {
    environment.dispose();
  }
});
