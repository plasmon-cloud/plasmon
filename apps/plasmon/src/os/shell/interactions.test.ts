// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import {
  closeNativeTaskContextProcess,
  nativeTaskContextProcessId,
  placeShellContextMenu,
} from "./interactions.ts";

test("taskbar context placement prefers above its invoking item and centers on the source", () => {
  expect(placeShellContextMenu(
    { left: 450, top: 640, width: 44, height: 44 },
    { width: 1000, height: 700 },
    { width: 230, height: 180 },
  )).toEqual({ x: 357, y: 454 });
});

test("taskbar context placement remains viewport-bounded at horizontal edges", () => {
  expect(placeShellContextMenu(
    { left: 2, top: 640, width: 44, height: 44 },
    { width: 1000, height: 700 },
    { width: 230, height: 180 },
  )).toEqual({ x: 8, y: 454 });

  expect(placeShellContextMenu(
    { left: 970, top: 640, width: 44, height: 44 },
    { width: 1000, height: 700 },
    { width: 230, height: 180 },
  )).toEqual({ x: 762, y: 454 });
});

test("context placement falls below a source when there is no usable space above", () => {
  expect(placeShellContextMenu(
    { left: 300, top: 10, width: 60, height: 40 },
    { width: 900, height: 700 },
    { width: 230, height: 180 },
  )).toEqual({ x: 215, y: 56 });
});

test("taskbar background pointer can use a zero-size source anchor", () => {
  expect(placeShellContextMenu(
    { left: 520, top: 690, width: 0, height: 0 },
    { width: 1000, height: 700 },
    { width: 230, height: 180 },
  )).toEqual({ x: 405, y: 504 });
});

test("native group context resolves Close only when exactly one canonical member is targeted", () => {
  expect(nativeTaskContextProcessId([])).toBeNull();
  expect(nativeTaskContextProcessId([{ id: "process:one" }])).toBe("process:one");
  expect(nativeTaskContextProcessId([{ id: "process:one" }, { id: "process:two" }])).toBeNull();
});

test("native context Close delegates only to ProcessController.close", () => {
  const calls: string[] = [];
  const process = {
    close(id: string) {
      calls.push(id);
      return true;
    },
  };

  expect(closeNativeTaskContextProcess(process, null)).toBe(false);
  expect(closeNativeTaskContextProcess(process, "process:two")).toBe(true);
  expect(calls).toEqual(["process:two"]);
});
