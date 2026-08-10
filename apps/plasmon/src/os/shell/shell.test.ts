// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type {
  ExternalElement,
  FsNode,
  NativeAppDefinition,
  NeutronBridge,
  ProcessController,
  ProcessRecord,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";
import { buildCalendarMonth } from "./calendar.ts";
import {
  decideNativeTaskbarAction,
  deriveStartEntries,
  deriveTaskbarEntries,
  deriveTrayEntries,
  openExternalElement,
} from "./model.ts";
import {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_PREFERENCES_KEY,
  ShellPreferenceStore,
  parseShellPreferences,
  validateShellPreferences,
  type ShellPreferences,
  type ShellStorage,
} from "./preferences.ts";
import { categorizeFsNode, LatestSearchController } from "./search.ts";
import { subscribeToNativeShellState } from "./subscriptions.ts";

const nativeText: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text Editor",
  icon: "text",
  defaultWindow: { width: 700, height: 500 },
  associations: [],
};

function element(id: string, running: ExternalElement["running"], trayTitle?: string): ExternalElement {
  return {
    id,
    name: `Name ${id}`,
    description: `Description ${id}`,
    ...(trayTitle ? { tray: { title: trayTitle } } : {}),
    tiles: [{ id: "main", title: "Main" }],
    running,
  };
}

function processRecord(id = "native:text#1"): ProcessRecord {
  return {
    id,
    appId: "native:text",
    handlerId: "native:text",
    target: {},
    title: "notes.txt — Text Editor",
    icon: "text",
    state: "running",
    windowId: `window:${id}`,
  };
}

function windowState(process: ProcessRecord, z: number, minimized = false): WindowState {
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

test("taskbar derivation does not include all installed applications", () => {
  const entries = deriveTaskbarEntries({
    preferences: preferences(),
    nativeApps: [nativeText],
    processes: [],
    elements: [element("mail", "no"), element("docs", "unknown")],
  });
  expect(entries).toEqual([]);
});

test("pinned native handler merges with its single open process", () => {
  const running = processRecord();
  const entries = deriveTaskbarEntries({
    preferences: preferences({ pinnedNative: ["native:text"] }),
    nativeApps: [nativeText],
    processes: [running],
    elements: [],
  });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    kind: "native",
    id: "native:native:text",
    pinned: true,
    process: { id: running.id },
  });
});

test("multiple native process records remain distinct taskbar entries", () => {
  const first = processRecord("native:text#1");
  const second = processRecord("native:text#2");
  const entries = deriveTaskbarEntries({
    preferences: preferences({ pinnedNative: ["native:text"] }),
    nativeApps: [nativeText],
    processes: [first, second],
    elements: [],
  });
  expect(entries.map((entry) => entry.id)).toEqual([
    "process:native:text#1",
    "process:native:text#2",
  ]);
});

test("native taskbar action focuses minimized/background windows and minimizes focused window", () => {
  const running = processRecord();
  const entry = deriveTaskbarEntries({
    preferences: preferences(),
    nativeApps: [nativeText],
    processes: [running],
    elements: [],
  })[0];
  if (!entry || entry.kind !== "native") throw new Error("Expected native taskbar entry");

  expect(decideNativeTaskbarAction(entry, [windowState(running, 3, true)])).toBe("focus");

  const other = processRecord("native:other#1");
  expect(decideNativeTaskbarAction(entry, [windowState(running, 3), windowState(other, 4)])).toBe("focus");
  expect(decideNativeTaskbarAction(entry, [windowState(running, 5), windowState(other, 4)])).toBe("minimize");
});

test("external taskbar entries preserve yes, no, and unknown", () => {
  const elements = [element("yes", "yes"), element("no", "no"), element("maybe", "unknown")];
  const entries = deriveTaskbarEntries({
    preferences: preferences({ pinnedElements: ["yes", "no", "maybe"] }),
    nativeApps: [],
    processes: [],
    elements,
  }).filter((entry) => entry.kind === "element");
  expect(entries.map((entry) => entry.running)).toEqual(["yes", "no", "unknown"]);
});

test("external launch delegates to NeutronBridge even when refresh fails", async () => {
  const calls: string[] = [];
  const bridge: NeutronBridge = {
    async loadElements() { return []; },
    async openElement(id) { calls.push(`open:${id}`); },
    async offerInstall() {},
    async refreshRuntimeState() { calls.push("refresh"); throw new Error("snapshot unavailable"); },
    subscribe() { return () => undefined; },
  };
  const result = await openExternalElement(bridge, "mail");
  expect(calls).toEqual(["refresh", "open:mail"]);
  expect(result.refreshError).toBeInstanceOf(Error);
});

test("Start entries derive names and descriptions from supplied registries", () => {
  const mail = element("mail", "unknown");
  mail.name = "Neutron Mail";
  mail.description = "Installed mail Element";
  const entries = deriveStartEntries([nativeText], [mail]);
  expect(entries).toEqual([
    expect.objectContaining({ kind: "element", name: "Neutron Mail", description: "Installed mail Element" }),
    expect.objectContaining({ kind: "native", name: "Text Editor", appId: "native:text" }),
  ]);
});

test("shell preference validation rejects malformed or unsafe serialized shapes", () => {
  expect(validateShellPreferences({
    version: 1,
    pinnedNative: ["native:text", 2],
    pinnedElements: [],
    themeId: "plasmon-dark",
    wallpaper: "aurora",
  })).toBeNull();
  expect(parseShellPreferences('{"version":1,"pinnedNative":[],"pinnedElements":[],"themeId":"evil","wallpaper":"aurora"}')).toBeNull();
  expect(validateShellPreferences({
    ...DEFAULT_SHELL_PREFERENCES,
    pinnedNative: ["native:text", "native:text"],
  })?.pinnedNative).toEqual(["native:text"]);
});

test("corrupt or throwing localStorage falls back to deterministic defaults", () => {
  const corrupt: ShellStorage = {
    getItem(key) {
      expect(key).toBe(SHELL_PREFERENCES_KEY);
      return "{not-json";
    },
    setItem() {},
  };
  expect(new ShellPreferenceStore(corrupt).load()).toEqual(DEFAULT_SHELL_PREFERENCES);

  const unavailable: ShellStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
  expect(new ShellPreferenceStore(unavailable).load()).toEqual(DEFAULT_SHELL_PREFERENCES);
  expect(new ShellPreferenceStore(unavailable).save(preferences())).toBe(false);
});

function node(patch: Partial<FsNode>): FsNode {
  return {
    id: "node",
    parentId: "root",
    name: "file.txt",
    kind: "file",
    size: 0,
    createdAt: 0,
    modifiedAt: 0,
    metadata: {},
    ...patch,
  };
}

test("search categorization distinguishes documents, media, and Atoms", () => {
  expect(categorizeFsNode(node({ name: "notes.md", mime: "text/markdown" }))).toBe("documents");
  expect(categorizeFsNode(node({ name: "clip.bin", mime: "video/mp4" }))).toBe("media");
  expect(categorizeFsNode(node({
    name: "draft.resource",
    kind: "file",
    metadata: { atom: { format: "plasmon.atom", atomType: "notepad2/v1", title: "Draft" } },
  }))).toBe("atoms");
});

test("stale async search completion cannot overwrite the newer query", async () => {
  const controller = new LatestSearchController<string>();
  const applied: string[] = [];
  let resolveOld!: (value: string) => void;
  let resolveNew!: (value: string) => void;
  const old = new Promise<string>((resolve) => { resolveOld = resolve; });
  const newer = new Promise<string>((resolve) => { resolveNew = resolve; });

  const oldRun = controller.run(() => old, (value) => applied.push(value));
  const newRun = controller.run(() => newer, (value) => applied.push(value));
  resolveNew("new");
  expect(await newRun).toBe(true);
  resolveOld("old");
  expect(await oldRun).toBe(false);
  expect(applied).toEqual(["new"]);
});

test("tray list uses only declared tray.title and excludes non-tray Elements", () => {
  const withTray = element("mail", "yes", "Inbox controls");
  withTray.name = "Do not mirror this name";
  const entries = deriveTrayEntries([withTray, element("docs", "yes")]);
  expect(entries).toEqual([{ elementId: "mail", title: "Inbox controls", running: "yes" }]);
  expect(Object.keys(entries[0] ?? {}).sort()).toEqual(["elementId", "running", "title"]);
});

test("calendar builds a stable six-week month grid with current-day marker", () => {
  const today = new Date(2026, 7, 10, 12, 0, 0);
  const month = buildCalendarMonth(new Date(2026, 7, 1, 12, 0, 0), today);
  expect(month.year).toBe(2026);
  expect(month.month).toBe(7);
  expect(month.days).toHaveLength(42);
  expect(month.days[0]?.date.getMonth()).toBe(6);
  expect(month.days[0]?.date.getDate()).toBe(26);
  expect(month.days.filter((day) => day.isToday).map((day) => day.day)).toEqual([10]);
});

function subscriptionFakes() {
  const processListeners = new Set<() => void>();
  const windowListeners = new Set<() => void>();
  const process: ProcessController = {
    async open() { return null; },
    focus() {}, close() {}, setTitle() {}, setTarget() {}, list() { return []; },
    subscribe(listener) { processListeners.add(listener); return () => processListeners.delete(listener); },
  };
  const windows: WindowManager = {
    create() { return "window"; },
    focus() {}, move() {}, resize() {}, minimize() {}, maximize() {}, restore() {}, close() {}, list() { return []; },
    subscribe(listener) { windowListeners.add(listener); return () => windowListeners.delete(listener); },
  };
  return { process, windows, processListeners, windowListeners };
}

test("native shell subscription cleanup detaches process and window listeners", () => {
  const state = subscriptionFakes();
  let updates = 0;
  const cleanup = subscribeToNativeShellState(state.process, state.windows, () => { updates += 1; });
  for (const listener of state.processListeners) listener();
  for (const listener of state.windowListeners) listener();
  expect(updates).toBe(2);
  cleanup();
  cleanup();
  expect(state.processListeners.size).toBe(0);
  expect(state.windowListeners.size).toBe(0);
});
