// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { NativeWindowManager } from "./NativeWindowManager.ts";

function ids() {
  let next = 0;
  return () => `window:placement:${++next}`;
}

function geometry(windows: NativeWindowManager, id: string) {
  const state = windows.get(id);
  if (!state) throw new Error("window was not created");
  return { x: state.x, y: state.y, width: state.width, height: state.height };
}

test("repeated open/close restarts default placement instead of accumulating lifetime cascade", () => {
  const windows = new NativeWindowManager({
    idFactory: ids(),
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  try {
    let first: ReturnType<typeof geometry> | undefined;
    let last: ReturnType<typeof geometry> | undefined;
    for (let index = 0; index < 60; index += 1) {
      const id = windows.create(`process:${index}`);
      const current = geometry(windows, id);
      first ??= current;
      last = current;
      windows.close(id);
    }
    expect(last).toEqual(first);
  } finally {
    windows.dispose();
  }
});

test("live default windows cascade through bounded slots and wrap deterministically", () => {
  const windows = new NativeWindowManager({
    idFactory: ids(),
    viewport: () => ({ x: 0, y: 0, width: 900, height: 620 }),
    defaultWidth: 500,
    defaultHeight: 360,
    listenForViewportChanges: false,
  });
  try {
    const states = Array.from({ length: 20 }, (_, index) => geometry(windows, windows.create(`process:${index}`)));
    const first = states[0];
    const second = states[1];
    expect(second.x).toBe(first.x + 28);
    expect(second.y).toBe(first.y + 28);
    for (const state of states) {
      expect(state.x).toBeGreaterThanOrEqual(0);
      expect(state.y).toBeGreaterThanOrEqual(0);
      expect(state.x + state.width).toBeLessThanOrEqual(900);
      expect(state.y + state.height).toBeLessThanOrEqual(620);
    }
    expect(new Set(states.map((state) => `${state.x},${state.y}`)).size).toBeGreaterThan(1);
    expect(states.some((state, index) => index > 0 && state.x === first.x && state.y === first.y)).toBe(true);
  } finally {
    windows.dispose();
  }
});

test("small viewport defaults remain reachable and explicit placement stays manager-constrained", () => {
  const windows = new NativeWindowManager({
    idFactory: ids(),
    viewport: () => ({ x: 20, y: 30, width: 260, height: 140 }),
    defaultWidth: 500,
    defaultHeight: 360,
    minWidth: 320,
    minHeight: 220,
    listenForViewportChanges: false,
  });
  try {
    const first = geometry(windows, windows.create("process:default"));
    expect(first.x).toBeGreaterThanOrEqual(20 - (first.width - 72));
    expect(first.x).toBeLessThanOrEqual(20 + 260 - 72);
    expect(first.y).toBeGreaterThanOrEqual(30);
    expect(first.y).toBeLessThanOrEqual(30 + 140 - 32);

    const explicit = geometry(windows, windows.create("process:explicit", { x: 10_000, y: 10_000, width: 420, height: 300 }));
    expect(explicit.x).toBeLessThanOrEqual(20 + 260 - 72);
    expect(explicit.y).toBeLessThanOrEqual(30 + 140 - 32);
  } finally {
    windows.dispose();
  }
});
