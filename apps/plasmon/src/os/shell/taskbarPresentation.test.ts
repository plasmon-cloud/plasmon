// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type {
  ExternalElement,
  NativeAppDefinition,
  ProcessRecord,
  WindowState,
} from "../contracts/index.ts";
import { deriveTaskbarEntries } from "./model.ts";
import type { ShellPreferences } from "./preferences.ts";

const nativeText: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text Editor",
  icon: "text",
  defaultWindow: { width: 700, height: 500 },
  associations: [],
};

function preferences(patch: Partial<ShellPreferences> = {}): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: "plasmon-dark",
    wallpaper: "aurora",
    ...patch,
  };
}

function processRecord(state: ProcessRecord["state"] = "running", id = "native:text#1"): ProcessRecord {
  return {
    id,
    appId: "native:text",
    handlerId: "native:text",
    target: {},
    title: "notes.txt — Text Editor",
    icon: "text",
    state,
    windowId: `window:${id}`,
  };
}

function windowState(process: ProcessRecord, z = 3, minimized = false): WindowState {
  return {
    id: process.windowId ?? `window:${process.id}`,
    processId: process.id,
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    z,
    minimized,
    maximized: false,
  };
}

function element(id: string, running: ExternalElement["running"]): ExternalElement {
  return {
    id,
    name: `Element ${id}`,
    description: `Description ${id}`,
    tiles: [{ id: "main", title: "Main" }],
    running,
  };
}

function onlyNative(input: {
  processes?: readonly ProcessRecord[];
  windows?: readonly WindowState[];
  focusedWindowId?: WindowState["id"] | null;
  busyTaskId?: string | null;
}) {
  const entries = deriveTaskbarEntries({
    preferences: preferences({ pinnedNative: ["native:text"] }),
    nativeApps: [nativeText],
    processes: input.processes ?? [],
    elements: [],
    windows: input.windows ?? [],
    focusedWindowId: input.focusedWindowId ?? null,
    busyTaskId: input.busyTaskId,
  });
  const entry = entries[0];
  if (!entry || entry.kind !== "native") throw new Error("Expected one native taskbar entry");
  return entry;
}

test("native taskbar presentation follows pin, launch, process, and canonical Windowing focus observations", () => {
  const pinned = onlyNative({});
  expect(pinned.presentation).toMatchObject({
    state: "pinned-only",
    statusLabel: "Pinned to taskbar",
    running: false,
    active: false,
    launching: false,
  });

  const busy = onlyNative({ busyTaskId: pinned.id });
  expect(busy.presentation).toMatchObject({ state: "launching", launching: true, running: false, badge: "…" });

  const starting = processRecord("starting");
  expect(onlyNative({ processes: [starting] }).presentation.state).toBe("launching");

  const running = processRecord("running");
  expect(onlyNative({
    processes: [running],
    windows: [windowState(running, 2, true)],
    focusedWindowId: running.windowId,
  }).presentation).toMatchObject({
    state: "running",
    running: true,
    active: false,
  });

  const other: WindowState = {
    id: "window:other",
    processId: "native:other#1",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    z: 9,
    minimized: false,
    maximized: false,
  };
  expect(onlyNative({
    processes: [running],
    windows: [windowState(running, 3), other],
    focusedWindowId: other.id,
  }).presentation.state).toBe("running");

  // Regression: focus authority is independent of z-order. A lower-z Files
  // window remains active when WindowManager.focusSnapshot() names it focused.
  const active = onlyNative({
    processes: [running],
    windows: [windowState(running, 3), other],
    focusedWindowId: running.windowId,
  });
  expect(active.presentation).toMatchObject({
    state: "active",
    statusLabel: "Active and focused",
    running: true,
    active: true,
  });
  expect(active.presentation.accessibilityLabel).toContain("Active and focused");
});

test("native group presentation uses running members before starting siblings and canonical focused id", () => {
  const background = processRecord("running", "native:text#1");
  const active = processRecord("running", "native:text#2");
  const starting = processRecord("starting", "native:text#3");
  const other: WindowState = {
    id: "window:other",
    processId: "native:other#1",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    z: 10,
    minimized: false,
    maximized: false,
  };

  const runningGroup = onlyNative({
    processes: [background, starting],
    windows: [windowState(background, 3), other],
    focusedWindowId: other.id,
    busyTaskId: "native:native:text",
  });
  expect(runningGroup.presentation).toMatchObject({ state: "running", running: true, active: false, launching: false });

  const activeGroup = onlyNative({
    processes: [background, active, starting],
    windows: [windowState(background, 3), windowState(active, 4), other],
    focusedWindowId: active.windowId,
    busyTaskId: "native:native:text",
  });
  expect(activeGroup.presentation).toMatchObject({ state: "active", running: true, active: true, launching: false });
  expect(activeGroup.members.map((member) => member.id)).toEqual([background.id, active.id, starting.id]);
});

test("Element taskbar presentation preserves confirmed running, confirmed stopped pin, and genuine uncertainty", () => {
  const entries = deriveTaskbarEntries({
    preferences: preferences({ pinnedElements: ["running", "stopped", "maybe"] }),
    nativeApps: [],
    processes: [],
    elements: [
      element("running", "yes"),
      element("stopped", "no"),
      element("maybe", "unknown"),
    ],
  }).filter((entry) => entry.kind === "element");

  expect(entries.map((entry) => entry.presentation.state)).toEqual(["running", "pinned-only", "uncertain"]);
  expect(entries[0]?.presentation).toMatchObject({ running: true, uncertain: false });
  expect(entries[1]?.presentation).toMatchObject({ running: false, uncertain: false, statusLabel: "Pinned to taskbar" });
  expect(entries[2]?.presentation).toMatchObject({
    state: "uncertain",
    running: false,
    uncertain: true,
    statusLabel: "Runtime status unavailable",
    badge: "?",
  });

  for (const entry of entries) {
    expect(entry.presentation.accessibilityLabel).not.toMatch(/\b(?:yes|no|unknown)\b/ui);
  }
  expect(entries[2]?.presentation.accessibilityLabel).not.toContain("Stopped");
});

test("transient Element busy state is presentation-only and does not strengthen unknown runtime observation", () => {
  const maybe = element("maybe", "unknown");
  const [entry] = deriveTaskbarEntries({
    preferences: preferences({ pinnedElements: [maybe.id] }),
    nativeApps: [],
    processes: [],
    elements: [maybe],
    busyTaskId: `element:${maybe.id}`,
  });

  expect(entry?.kind).toBe("element");
  expect(entry?.presentation).toMatchObject({
    state: "launching",
    statusLabel: "Opening",
    launching: true,
    running: false,
    uncertain: true,
    badge: "…",
  });
});
