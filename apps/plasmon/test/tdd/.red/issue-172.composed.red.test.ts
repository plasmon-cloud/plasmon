import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { reconcileDesktopPositions } from "../../../src/os/desktop/layout.ts";

function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x < b.x + 92 && a.x + 92 > b.x && a.y < b.y + 88 && a.y + 88 > b.y;
}

const workspace = { width: 640, height: 480 };

test("#172 composed regression — free prior Desktop slot survives Trash restore", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const desktop = await environment.node("/Desktop");
    if (!desktop) throw new Error("Desktop bootstrap missing");
    const original = await environment.services.fs.createFile(desktop.id, "restore-free.txt", { mime: "text/plain" });
    const occupant = await environment.services.fs.createFile(desktop.id, "incumbent-free.txt", { mime: "text/plain" });
    const unrelated = await environment.services.fs.createFile(desktop.id, "unrelated-free.txt", { mime: "text/plain" });
    const originalPosition = { x: 16, y: 16 };
    const positions = {
      [original.id]: originalPosition,
      [occupant.id]: { x: 120, y: 16 },
      [unrelated.id]: { x: 224, y: 16 },
    };
    const trashed = await environment.services.filesystem.trash.trash(original.id);
    const restored = await environment.services.filesystem.trash.restore(trashed.node.id, "/Desktop");
    expect(restored.node).toMatchObject({ id: original.id, name: "restore-free.txt", parentId: desktop.id });
    expect((await environment.node("/Desktop/restore-free.txt"))?.id).toBe(original.id);

    const reconciled = reconcileDesktopPositions(
      positions,
      [restored.node.id, occupant.id, unrelated.id],
      workspace,
      [occupant.id, unrelated.id],
    );
    expect(reconciled[restored.node.id]).toEqual(originalPosition);
    expect(reconciled[occupant.id]).toEqual(positions[occupant.id]);
    expect(reconciled[unrelated.id]).toEqual(positions[unrelated.id]);
    expect(reconcileDesktopPositions(reconciled, [restored.node.id, occupant.id, unrelated.id], workspace,
      [restored.node.id, occupant.id, unrelated.id])).toEqual(reconciled);
  } finally {
    environment.dispose();
  }
});

test("#172 composed regression — occupied Desktop slot gets deterministic free placement", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const desktop = await environment.node("/Desktop");
    if (!desktop) throw new Error("Desktop bootstrap missing");
    const original = await environment.services.fs.createFile(desktop.id, "restore-occupied.txt", { mime: "text/plain" });
    const occupant = await environment.services.fs.createFile(desktop.id, "incumbent-occupied.txt", { mime: "text/plain" });
    const unrelated = await environment.services.fs.createFile(desktop.id, "unrelated-occupied.txt", { mime: "text/plain" });
    const occupiedPosition = { x: 16, y: 16 };
    const positions = {
      [original.id]: occupiedPosition,
      [occupant.id]: occupiedPosition,
      [unrelated.id]: { x: 224, y: 16 },
    };
    const trashed = await environment.services.filesystem.trash.trash(original.id);
    const incumbentBefore = await environment.services.fs.stat(occupant.id);
    const restored = await environment.services.filesystem.trash.restore(trashed.node.id, "/Desktop");
    expect(restored.node.id).toBe(original.id);
    expect((await environment.services.fs.stat(occupant.id)).id).toBe(incumbentBefore.id);

    const reconciled = reconcileDesktopPositions(
      positions,
      [restored.node.id, occupant.id, unrelated.id],
      workspace,
      [occupant.id, unrelated.id],
    );
    expect(reconciled[occupant.id]).toEqual(occupiedPosition);
    expect(reconciled[unrelated.id]).toEqual(positions[unrelated.id]);
    expect(reconciled[restored.node.id]).toBeDefined();
    expect(overlaps(reconciled[occupant.id]!, reconciled[restored.node.id]!)).toBe(false);
    expect(reconcileDesktopPositions(reconciled, [restored.node.id, occupant.id, unrelated.id], workspace,
      [restored.node.id, occupant.id, unrelated.id])).toEqual(reconciled);
  } finally {
    environment.dispose();
  }
});
