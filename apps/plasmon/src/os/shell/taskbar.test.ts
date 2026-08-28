// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type { NativeAppDefinition, ProcessRecord, WindowState } from "../contracts/index.ts";
import { DEFAULT_SHELL_PREFERENCES } from "./preferences.ts";
import {
  closeNativeTaskContextProcess,
  decideNativeTaskbarAction,
  deriveTaskbarProjection,
  nativeTaskContextProcessId,
  placeTaskbarContextMenu,
  taskbarContextMenuHeight,
} from "./taskbar.ts";

const nativeText: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text Editor",
  icon: "text",
  defaultWindow: { width: 700, height: 500 },
  associations: [],
};

function processRecord(id: string): ProcessRecord {
  return {
    id,
    appId: nativeText.id,
    handlerId: nativeText.handlerId,
    target: {},
    title: "Text Editor",
    icon: nativeText.icon,
    state: "running",
    windowId: `window:${id}`,
  };
}

function windowState(process: ProcessRecord, z: number, minimized = false): WindowState {
  return {
    id: process.windowId ?? `window:${process.id}`,
    processId: process.id,
    x: 20,
    y: 20,
    width: 600,
    height: 400,
    z,
    minimized,
    maximized: false,
  };
}

test("focused taskbar projection groups canonical Process records and uses canonical Windowing focus", () => {
  const first = processRecord("native:text#1");
  const second = processRecord("native:text#2");
  const firstWindow = windowState(first, 9);
  const secondWindow = windowState(second, 2);

  const [entry] = deriveTaskbarProjection({
    preferences: { ...DEFAULT_SHELL_PREFERENCES, pinnedNative: [nativeText.handlerId] },
    nativeApps: [nativeText],
    processes: [first, second],
    elements: [],
    windows: [firstWindow, secondWindow],
    focusedWindowId: secondWindow.id,
  });

  expect(entry?.kind).toBe("native");
  if (!entry || entry.kind !== "native") throw new Error("Expected canonical native taskbar group");
  expect(entry.members.map((member) => member.id)).toEqual([first.id, second.id]);
  expect(entry.presentation.state).toBe("active");
  expect(decideNativeTaskbarAction(entry, [firstWindow, secondWindow], secondWindow.id)).toBe("choose");
});

test("taskbar projection does not strengthen a minimized focused id into active presentation", () => {
  const process = processRecord("native:text#1");
  const minimized = windowState(process, 1, true);
  const [entry] = deriveTaskbarProjection({
    preferences: { ...DEFAULT_SHELL_PREFERENCES, pinnedNative: [nativeText.handlerId] },
    nativeApps: [nativeText],
    processes: [process],
    elements: [],
    windows: [minimized],
    focusedWindowId: minimized.id,
  });

  expect(entry?.presentation.state).toBe("running");
  if (!entry || entry.kind !== "native") throw new Error("Expected native taskbar entry");
  expect(decideNativeTaskbarAction(entry, [minimized], minimized.id)).toBe("focus");
});

test("taskbar context policy remains pure and Close delegates only to Process authority", () => {
  const menuHeight = taskbarContextMenuHeight(2);
  expect(placeTaskbarContextMenu(
    { left: 970, top: 640, width: 44, height: 44 },
    { width: 1000, height: 700 },
    { width: 230, height: menuHeight },
  )).toEqual({ x: 762, y: 515 });

  expect(nativeTaskContextProcessId([{ id: "one" }, { id: "two" }])).toBeNull();
  const calls: string[] = [];
  expect(closeNativeTaskContextProcess({ close(id) { calls.push(id); return true; } }, "one")).toBe(true);
  expect(calls).toEqual(["one"]);
});
