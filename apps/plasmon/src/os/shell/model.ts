import type {
  ExternalElement,
  NativeAppDefinition,
  NativeAppRegistry,
  ProcessController,
  ProcessRecord,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";

export type ExternalRunningState = ExternalElement["running"];

export type NativeTaskbarEntry = {
  kind: "native";
  id: string;
  appId: string;
  handlerId: string;
  name: string;
  icon: string;
  pinned: boolean;
  processes: readonly ProcessRecord[];
  processId?: string;
  running: boolean;
  focused: boolean;
  minimized: boolean;
};

export type ElementTaskbarEntry = {
  kind: "element";
  id: `element:${string}`;
  appId: string;
  name: string;
  icon?: string;
  pinned: boolean;
  running: ExternalRunningState;
};

export type TaskbarEntry = NativeTaskbarEntry | ElementTaskbarEntry;

function topWindow(windows: readonly WindowState[]): WindowState | null {
  let best: WindowState | null = null;
  for (const window of windows) {
    if (window.minimized) continue;
    if (!best || window.z > best.z) best = window;
  }
  return best;
}

function processWindow(record: ProcessRecord, windows: readonly WindowState[]): WindowState | null {
  if (record.windowId) return windows.find((window) => window.id === record.windowId) ?? null;
  return windows.find((window) => window.processId === record.id) ?? null;
}

function nativeDefinitionForProcess(
  process: ProcessRecord,
  nativeApps: NativeAppRegistry,
): NativeAppDefinition | null {
  return nativeApps.get(process.appId) ?? nativeApps.getByHandler(process.handlerId);
}

export function deriveTaskbarEntries(input: {
  pinnedNative: readonly string[];
  pinnedElements: readonly string[];
  processes: readonly ProcessRecord[];
  windows: readonly WindowState[];
  nativeApps: NativeAppRegistry;
  elements: readonly ExternalElement[];
}): TaskbarEntry[] {
  const { pinnedNative, pinnedElements, processes, windows, nativeApps, elements } = input;
  const pinnedNativeSet = new Set(pinnedNative);
  const pinnedElementSet = new Set(pinnedElements);
  const focusedWindow = topWindow(windows);
  const result: TaskbarEntry[] = [];
  const emittedNative = new Set<string>();

  for (const handlerId of pinnedNative) {
    const app = nativeApps.getByHandler(handlerId);
    if (!app || emittedNative.has(app.id)) continue;
    const open = processes.filter((process) => process.appId === app.id && process.state !== "closing");
    if (open.length <= 1) {
      const record = open[0];
      const window = record ? processWindow(record, windows) : null;
      result.push({
        kind: "native",
        id: `native:${app.id}`,
        appId: app.id,
        handlerId: app.handlerId,
        name: record?.title || app.name,
        icon: app.icon,
        pinned: true,
        processes: open,
        ...(record ? { processId: record.id } : {}),
        running: open.length > 0,
        focused: !!(window && focusedWindow?.id === window.id),
        minimized: !!window?.minimized,
      });
      emittedNative.add(app.id);
    }
  }

  const openByApp = new Map<string, ProcessRecord[]>();
  for (const process of processes) {
    if (process.state === "closing") continue;
    const list = openByApp.get(process.appId) ?? [];
    list.push(process);
    openByApp.set(process.appId, list);
  }

  for (const [appId, open] of openByApp) {
    const definition = nativeDefinitionForProcess(open[0] as ProcessRecord, nativeApps);
    if (!definition) continue;
    const alreadyPinned = emittedNative.has(appId);
    if (open.length === 1 && alreadyPinned) continue;

    if (open.length === 1) {
      const record = open[0] as ProcessRecord;
      const window = processWindow(record, windows);
      result.push({
        kind: "native",
        id: `native:${appId}`,
        appId,
        handlerId: definition.handlerId,
        name: record.title || definition.name,
        icon: record.icon || definition.icon,
        pinned: pinnedNativeSet.has(definition.handlerId),
        processes: open,
        processId: record.id,
        running: true,
        focused: !!(window && focusedWindow?.id === window.id),
        minimized: !!window?.minimized,
      });
      emittedNative.add(appId);
      continue;
    }

    // MVP preserves distinct process records rather than collapsing multiple
    // instances into an ambiguous single button without a preview UI.
    for (const record of open) {
      const window = processWindow(record, windows);
      result.push({
        kind: "native",
        id: `process:${record.id}`,
        appId,
        handlerId: definition.handlerId,
        name: record.title || definition.name,
        icon: record.icon || definition.icon,
        pinned: pinnedNativeSet.has(definition.handlerId),
        processes: [record],
        processId: record.id,
        running: true,
        focused: !!(window && focusedWindow?.id === window.id),
        minimized: !!window?.minimized,
      });
    }
    emittedNative.add(appId);
  }

  for (const element of elements) {
    if (!pinnedElementSet.has(element.id) && element.running !== "yes") continue;
    result.push({
      kind: "element",
      id: `element:${element.id}`,
      appId: element.id,
      name: element.name,
      ...(element.icon ? { icon: element.icon } : {}),
      pinned: pinnedElementSet.has(element.id),
      running: element.running,
    });
  }

  // Keep pinned Elements visible even when discovery returned no current item.
  // We cannot fabricate metadata, so unresolved pins are intentionally omitted.
  return result;
}

export type NativeTaskbarAction = "launch" | "focus" | "minimize";

export function nativeTaskbarAction(entry: NativeTaskbarEntry): NativeTaskbarAction {
  if (!entry.running || !entry.processId) return "launch";
  if (entry.focused && !entry.minimized) return "minimize";
  return "focus";
}

export async function activateNativeTaskbarEntry(
  entry: NativeTaskbarEntry,
  process: ProcessController,
  windows: WindowManager,
): Promise<void> {
  const action = nativeTaskbarAction(entry);
  if (action === "launch") {
    await process.open(entry.handlerId, {});
    return;
  }
  if (!entry.processId) return;
  if (action === "focus") {
    process.focus(entry.processId);
    return;
  }
  const record = process.list().find((candidate) => candidate.id === entry.processId);
  if (!record?.windowId) return;
  windows.minimize(record.windowId);
}

export function preserveExternalRunning(value: ExternalRunningState): ExternalRunningState {
  return value;
}

export function deriveTrayEntries(elements: readonly ExternalElement[]): Array<{
  appId: string;
  title: string;
  running: ExternalRunningState;
}> {
  return elements.flatMap((element) => element.tray?.title
    ? [{ appId: element.id, title: element.tray.title, running: element.running }]
    : []);
}
