import { expect, test } from "bun:test";
import { NativeWindowManager } from "../../../src/os/windowing/NativeWindowManager.ts";

test("repeated open/close returns to a bounded default placement when cascade space is exhausted", () => {
  let nextId = 0;
  const windows = new NativeWindowManager({
    idFactory: () => `window:placement:${++nextId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  try {
    let first: { x: number; y: number; width: number; height: number } | undefined;
    let last: { x: number; y: number; width: number; height: number } | undefined;
    for (let index = 0; index < 60; index += 1) {
      const id = windows.create(`process:${index}`);
      const state = windows.get(id);
      if (!state) throw new Error("window was not created");
      const geometry = { x: state.x, y: state.y, width: state.width, height: state.height };
      first ??= geometry;
      last = geometry;
      windows.close(id);
    }

    // With no surviving window occupying the workspace, the placement policy
    // must wrap/restart rather than permanently clamp later launches to an
    // edge position. This is the repeated open/close r1 regression.
    expect(last).toEqual(first);
  } finally {
    windows.dispose();
  }
});
