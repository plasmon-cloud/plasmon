// @ts-ignore -- bun:test is available to the repository test runner but excluded from the browser tsconfig globals.
import { expect, test } from "bun:test";
import type { WindowState } from "../contracts/window.ts";
import { NativeWindowManager } from "./NativeWindowManager.ts";

function ids() {
  let next = 0;
  return () => `window:test:${++next}`;
}

function manager(width = 1200, height = 800): NativeWindowManager {
  return new NativeWindowManager({
    idFactory: ids(),
    viewport: () => ({ x: 0, y: 0, width, height }),
    listenForViewportChanges: false,
  });
}

test("creates cascaded windows with stable process identity and minimums", () => {
  const windows = manager();
  const firstId = windows.create("process:one", { width: 640, height: 480, minWidth: 320, minHeight: 220 });
  const secondId = windows.create("process:two", {});
  const [first, second] = windows.list();

  expect(first?.id).toBe(firstId);
  expect(first?.processId).toBe("process:one");
  expect(first?.minWidth).toBe(320);
  expect(first?.minHeight).toBe(220);
  expect(second?.id).toBe(secondId);
  expect(second?.x).toBe((first?.x ?? 0) + 28);
  expect(second?.y).toBe((first?.y ?? 0) + 28);
  expect((second?.z ?? 0) > (first?.z ?? 0)).toBe(true);
});

test("focus raises z-order without coupling to process state", () => {
  const windows = manager();
  const first = windows.create("process:one", {});
  const second = windows.create("process:two", {});
  const secondZ = windows.get(second)?.z ?? 0;

  windows.focus(first);

  expect((windows.get(first)?.z ?? 0) > secondZ).toBe(true);
  expect(windows.list().at(-1)?.id).toBe(first);
});

test("focus restores a normal minimized window", () => {
  const windows = manager();
  const id = windows.create("process:one", {});
  windows.minimize(id);

  windows.focus(id);

  expect(windows.get(id)).toMatchObject({ minimized: false, maximized: false });
});

test("focus restores a minimized maximized window without unmaximizing it", () => {
  const windows = manager(900, 600);
  const id = windows.create("process:one", { x: 40, y: 50, width: 500, height: 350 });
  windows.maximize(id);
  windows.minimize(id);

  windows.focus(id);

  expect(windows.get(id)).toMatchObject({
    minimized: false,
    maximized: true,
    x: 0,
    y: 0,
    width: 900,
    height: 600,
  });
});

test("focus preserves restore geometry for a minimized maximized window", () => {
  const windows = manager(900, 600);
  const id = windows.create("process:one", { x: 40, y: 50, width: 500, height: 350 });
  windows.maximize(id);
  const restoreGeometry = windows.get(id)?.restoreGeometry;
  windows.minimize(id);

  windows.focus(id);

  expect(windows.get(id)?.restoreGeometry).toEqual(restoreGeometry);
  windows.restore(id);
  expect(windows.get(id)).toMatchObject({
    minimized: false,
    maximized: false,
    x: 40,
    y: 50,
    width: 500,
    height: 350,
  });
});

test("focus raises a minimized window after making it visible", () => {
  const windows = manager();
  const first = windows.create("process:one", {});
  const second = windows.create("process:two", {});
  const secondZ = windows.get(second)?.z ?? 0;
  windows.minimize(first);

  windows.focus(first);

  expect(windows.get(first)?.minimized).toBe(false);
  expect((windows.get(first)?.z ?? 0) > secondZ).toBe(true);
  expect(windows.list().at(-1)?.id).toBe(first);
});

test("move and resize enforce reachability and per-window minimum dimensions", () => {
  const windows = manager(1000, 700);
  const id = windows.create("process:one", { width: 500, height: 360, minWidth: 300, minHeight: 210 });

  windows.resize(id, 20, 30);
  expect(windows.get(id)?.width).toBe(300);
  expect(windows.get(id)?.height).toBe(210);

  windows.move(id, 10_000, 10_000);
  const moved = windows.get(id);
  expect(moved?.x).toBe(928);
  expect(moved?.y).toBe(668);
});

test("maximize stores restore geometry and restore reinstates it", () => {
  const windows = manager(1000, 700);
  const id = windows.create("process:one", { x: 120, y: 90, width: 620, height: 410 });
  const before = windows.get(id);

  windows.maximize(id);
  const maximized = windows.get(id);
  expect(maximized).toMatchObject({ x: 0, y: 0, width: 1000, height: 700, maximized: true, minimized: false });
  expect(maximized?.restoreGeometry).toEqual({ x: before?.x, y: before?.y, width: before?.width, height: before?.height });

  windows.restore(id);
  expect(windows.get(id)).toMatchObject({
    x: before?.x,
    y: before?.y,
    width: before?.width,
    height: before?.height,
    maximized: false,
    minimized: false,
  });
  expect(windows.get(id)?.restoreGeometry).toBeUndefined();
});

test("minimized maximized windows restore to maximized before unmaximizing", () => {
  const windows = manager(900, 600);
  const id = windows.create("process:one", { x: 40, y: 50, width: 500, height: 350 });
  windows.maximize(id);
  windows.minimize(id);

  windows.restore(id);
  expect(windows.get(id)).toMatchObject({ minimized: false, maximized: true, width: 900, height: 600 });

  windows.restore(id);
  expect(windows.get(id)).toMatchObject({ minimized: false, maximized: false, x: 40, y: 50, width: 500, height: 350 });
});

test("subscriptions fire for real state changes and unsubscribe cleanly", () => {
  const windows = manager();
  let updates = 0;
  const unsubscribe = windows.subscribe(() => { updates += 1; });
  const id = windows.create("process:one", {});
  windows.minimize(id);
  windows.minimize(id);
  windows.close("missing-window");
  windows.close(id);
  unsubscribe();
  windows.create("process:two", {});

  expect(updates).toBe(3);
});

test("viewport changes reflow normal windows and live maximized windows", () => {
  const windows = manager(1200, 800);
  const normal = windows.create("process:normal", { x: 1100, y: 760, width: 700, height: 600, minWidth: 260, minHeight: 180 });
  const maximized = windows.create("process:max", { width: 500, height: 400 });
  windows.maximize(maximized);

  windows.setViewport({ x: 0, y: 0, width: 640, height: 360 });

  expect(windows.get(maximized)).toMatchObject({ x: 0, y: 0, width: 640, height: 360, maximized: true });
  expect(windows.get(normal)).toMatchObject({ width: 640, height: 360 });
  expect((windows.get(normal)?.x ?? 9999) <= 568).toBe(true);
  expect((windows.get(normal)?.y ?? 9999) <= 328).toBe(true);
});

test("tiny viewports preserve minimum window size while keeping titlebar reachable", () => {
  const windows = manager(800, 600);
  const id = windows.create("process:one", { x: 600, y: 500, width: 400, height: 300, minWidth: 320, minHeight: 220 });

  windows.setViewport({ x: 0, y: 0, width: 250, height: 120 });
  const state = windows.get(id);

  expect(state?.width).toBe(320);
  expect(state?.height).toBe(220);
  expect((state?.x ?? -999) >= -248 && (state?.x ?? 999) <= 178).toBe(true);
  expect((state?.y ?? -999) >= 0 && (state?.y ?? 999) <= 88).toBe(true);
});

test("list and get return detached snapshots", () => {
  const windows = manager();
  const id = windows.create("process:one", { x: 80, y: 70, width: 500, height: 360 });
  windows.maximize(id);
  const snapshot = windows.get(id) as WindowState;
  snapshot.x = 9999;
  if (snapshot.restoreGeometry) snapshot.restoreGeometry.x = 9999;

  expect(windows.get(id)?.x).toBe(0);
  expect(windows.get(id)?.restoreGeometry?.x).toBe(80);
});
