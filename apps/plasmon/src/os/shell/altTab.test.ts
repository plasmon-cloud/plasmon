import { expect, test } from "bun:test";
import type { ProcessRecord, WindowFocusSnapshot, WindowState } from "../contracts/index.ts";
import {
  altTabCommitWindowId,
  beginAltTabSession,
  cycleAltTabSession,
  deriveAltTabEntries,
  reconcileAltTabSession,
} from "./altTab.ts";

const windows: WindowState[] = [
  { id: "w1", processId: "p1", x: 0, y: 0, width: 640, height: 480, z: 101, minimized: false, maximized: false },
  { id: "w2", processId: "p2", x: 20, y: 20, width: 640, height: 480, z: 102, minimized: true, maximized: false },
  { id: "w3", processId: "p3", x: 40, y: 40, width: 640, height: 480, z: 103, minimized: false, maximized: false },
];
const snapshot: WindowFocusSnapshot = { focusedId: "w3", mru: ["w3", "w2", "w1"] };
const processes: ProcessRecord[] = [
  { id: "p1", appId: "a1", handlerId: "native:one", target: {}, title: "One", icon: "one.svg", state: "running", windowId: "w1" },
  { id: "p2", appId: "a2", handlerId: "native:two", target: {}, title: "Two", icon: "two.svg", state: "running", windowId: "w2" },
  { id: "p3", appId: "a3", handlerId: "native:three", target: {}, title: "Three", icon: "three.svg", state: "running", windowId: "w3" },
];

test("#63 begins from canonical Windowing MRU without selecting by z/process order", () => {
  const session = beginAltTabSession(snapshot, windows)!;
  expect(session.windowIds).toEqual(["w3", "w2", "w1"]);
  expect(session.selectedWindowId).toBe("w2");
  expect(cycleAltTabSession(session).selectedWindowId).toBe("w1");
  expect(cycleAltTabSession(session, true).selectedWindowId).toBe("w3");
});

test("#63 keeps minimized members switchable and excludes windows that close while held", () => {
  const session = beginAltTabSession(snapshot, windows)!;
  const entries = deriveAltTabEntries(session, windows, processes);
  expect(entries.map((entry) => [entry.windowId, entry.minimized, entry.selected])).toEqual([
    ["w3", false, false],
    ["w2", true, true],
    ["w1", false, false],
  ]);

  const afterClose = reconcileAltTabSession(session, windows.filter((windowState) => windowState.id !== "w2"))!;
  expect(afterClose.windowIds).toEqual(["w3", "w1"]);
  expect(afterClose.selectedWindowId).toBe("w3");
  expect(altTabCommitWindowId(afterClose, windows.filter((windowState) => windowState.id !== "w2"))).toBe("w3");
});

test("#63 refuses a switcher when fewer than two canonical windows are live", () => {
  expect(beginAltTabSession({ focusedId: "w1", mru: ["w1"] }, windows.slice(0, 1))).toBeNull();
});
