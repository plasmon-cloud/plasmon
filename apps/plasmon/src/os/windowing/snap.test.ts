// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import {
  horizontalSnapGeometry,
  type WindowViewport,
} from "./geometry.ts";
import { horizontalSnapSideAtPointer } from "./interaction.ts";
import { NativeWindowManager } from "./NativeWindowManager.ts";

function ids() {
  let next = 0;
  return () => `window:snap:${++next}`;
}

function manager(viewport: WindowViewport = { x: 0, y: 0, width: 1200, height: 800 }): NativeWindowManager {
  return new NativeWindowManager({
    idFactory: ids(),
    viewport: () => viewport,
    listenForViewportChanges: false,
  });
}

test("horizontal snap geometry splits the full viewport deterministically and respects its origin", () => {
  const viewport = { x: 37, y: 19, width: 1001, height: 701 };

  expect(horizontalSnapGeometry(viewport, "left")).toEqual({
    x: 37,
    y: 19,
    width: 500,
    height: 701,
  });
  expect(horizontalSnapGeometry(viewport, "right")).toEqual({
    x: 537,
    y: 19,
    width: 501,
    height: 701,
  });
});

test("horizontal edge detection activates only inside the bounded left/right threshold", () => {
  const bounds = { left: 100, right: 900 };

  expect(horizontalSnapSideAtPointer(100, bounds)).toBe("left");
  expect(horizontalSnapSideAtPointer(112, bounds)).toBe("left");
  expect(horizontalSnapSideAtPointer(113, bounds)).toBeNull();
  expect(horizontalSnapSideAtPointer(887, bounds)).toBeNull();
  expect(horizontalSnapSideAtPointer(888, bounds)).toBe("right");
  expect(horizontalSnapSideAtPointer(900, bounds)).toBe("right");
});

test("snap stores the final floating drag geometry and restore returns to it", () => {
  const windows = manager({ x: 20, y: 10, width: 1000, height: 700 });
  const id = windows.create("process:one", { x: 100, y: 80, width: 600, height: 420 });
  const preSnap = { x: 210, y: 140, width: 600, height: 420 };

  windows.snap(id, "left", preSnap);

  expect(windows.getSnapSide(id)).toBe("left");
  expect(windows.get(id)).toMatchObject({
    x: 20,
    y: 10,
    width: 500,
    height: 700,
    minimized: false,
    maximized: false,
    restoreGeometry: preSnap,
  });

  windows.restore(id);
  expect(windows.getSnapSide(id)).toBeNull();
  expect(windows.get(id)).toMatchObject({ ...preSnap, minimized: false, maximized: false });
  expect(windows.get(id)?.restoreGeometry).toBeUndefined();
});

test("switching snap sides preserves the original pre-snap floating geometry", () => {
  const windows = manager({ x: 0, y: 0, width: 1200, height: 800 });
  const id = windows.create("process:one", { x: 120, y: 90, width: 640, height: 460 });
  const before = { x: 120, y: 90, width: 640, height: 460 };

  windows.snap(id, "left");
  windows.snap(id, "right");

  expect(windows.getSnapSide(id)).toBe("right");
  expect(windows.get(id)).toMatchObject({ x: 600, y: 0, width: 600, height: 800, restoreGeometry: before });

  windows.restore(id);
  expect(windows.get(id)).toMatchObject(before);
});

test("minimize and focus preserve snap placement while making the window visible and raised", () => {
  const windows = manager({ x: 0, y: 0, width: 1000, height: 700 });
  const snapped = windows.create("process:snapped", { x: 80, y: 70, width: 520, height: 360 });
  const other = windows.create("process:other", {});
  windows.snap(snapped, "left");
  const restoreGeometry = windows.get(snapped)?.restoreGeometry;
  windows.minimize(snapped);
  const otherZ = windows.get(other)?.z ?? 0;

  windows.focus(snapped);

  expect(windows.getSnapSide(snapped)).toBe("left");
  expect(windows.get(snapped)).toMatchObject({
    minimized: false,
    maximized: false,
    x: 0,
    y: 0,
    width: 500,
    height: 700,
    restoreGeometry,
  });
  expect((windows.get(snapped)?.z ?? 0) > otherZ).toBe(true);
});

test("maximize and restore round-trip through snap without corrupting pre-snap geometry", () => {
  const windows = manager({ x: 10, y: 20, width: 900, height: 600 });
  const id = windows.create("process:one", { x: 90, y: 80, width: 500, height: 350 });
  const before = { x: 90, y: 80, width: 500, height: 350 };
  windows.snap(id, "right");

  windows.maximize(id);
  expect(windows.getSnapSide(id)).toBeNull();
  expect(windows.get(id)).toMatchObject({
    x: 10,
    y: 20,
    width: 900,
    height: 600,
    maximized: true,
    restoreGeometry: before,
  });

  windows.restore(id);
  expect(windows.getSnapSide(id)).toBe("right");
  expect(windows.get(id)).toMatchObject({
    x: 460,
    y: 20,
    width: 450,
    height: 600,
    maximized: false,
    restoreGeometry: before,
  });

  windows.restore(id);
  expect(windows.getSnapSide(id)).toBeNull();
  expect(windows.get(id)).toMatchObject(before);
  expect(windows.get(id)?.restoreGeometry).toBeUndefined();
});

test("minimized maximized windows retain their underlying snap placement", () => {
  const windows = manager({ x: 0, y: 0, width: 1000, height: 700 });
  const id = windows.create("process:one", { x: 100, y: 90, width: 520, height: 360 });
  windows.snap(id, "left");
  windows.maximize(id);
  windows.minimize(id);

  windows.focus(id);
  expect(windows.get(id)).toMatchObject({ minimized: false, maximized: true, width: 1000, height: 700 });
  expect(windows.getSnapSide(id)).toBeNull();

  windows.restore(id);
  expect(windows.getSnapSide(id)).toBe("left");
  expect(windows.get(id)).toMatchObject({ maximized: false, x: 0, y: 0, width: 500, height: 700 });
});

test("viewport changes recompute snapped geometry without replacing pre-snap restore geometry", () => {
  const windows = manager({ x: 0, y: 0, width: 1200, height: 800 });
  const id = windows.create("process:one", { x: 100, y: 90, width: 620, height: 440 });
  const before = windows.get(id);
  windows.snap(id, "right");

  windows.setViewport({ x: 25, y: 15, width: 801, height: 501 });

  expect(windows.getSnapSide(id)).toBe("right");
  expect(windows.get(id)).toMatchObject({
    x: 425,
    y: 15,
    width: 401,
    height: 501,
    restoreGeometry: {
      x: before?.x,
      y: before?.y,
      width: before?.width,
      height: before?.height,
    },
  });
});

test("a direct floating geometry edit exits snap state deterministically", () => {
  const windows = manager({ x: 0, y: 0, width: 1000, height: 700 });
  const id = windows.create("process:one", { x: 100, y: 80, width: 500, height: 350 });
  windows.snap(id, "left");

  windows.move(id, 120, 40);

  expect(windows.getSnapSide(id)).toBeNull();
  expect(windows.get(id)).toMatchObject({ x: 120, y: 40, width: 500, height: 700, maximized: false });
  expect(windows.get(id)?.restoreGeometry).toBeUndefined();
});
