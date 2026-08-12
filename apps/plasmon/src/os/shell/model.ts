import type {
  ExternalElement,
  HandlerId,
  IconRef,
  NativeAppDefinition,
  NeutronBridge,
  OpenTarget,
  ProcessController,
  ProcessRecord,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";
import type { ShellPreferences } from "./preferences.ts";

export type ExternalRunning = ExternalElement["running"];

export interface NativeTaskbarEntry {
  kind: "native";
  id: string;
  handlerId: HandlerId;
  appId: string;
  name: string;
  icon: IconRef;
  pinned: boolean;
  process: ProcessRecord | null;
}

export interface ElementTaskbarEntry {
  kind: "element";
  id: string;
  elementId: string;
  name: string;
  icon?: string;
  pinned: boolean;
  running: ExternalRunning;
}

export type TaskbarEntry = NativeTaskbarEntry | ElementTaskbarEntry;

export type TaskbarPresentationState = "pinned-only" | "launching" | "running" | "active" | "uncertain";

export interface TaskbarPresentation {
  state: TaskbarPresentationState;
  statusLabel: string;
  accessibilityLabel: string;
  running: boolean;
  active: boolean;
  launching: boolean;
  uncertain: boolean;
  badge?: string;
}

export type PresentedTaskbarEntry = TaskbarEntry & { presentation: TaskbarPresentation };

export interface TaskbarModelInput {
  preferences: ShellPreferences;
  nativeApps: readonly NativeAppDefinition[];
  processes: readonly ProcessRecord[];
  elements: readonly ExternalElement[];
  windows?: readonly WindowState[];
  busyTaskId?: string | null;
}

function nativeMetadataForProcess(
  process: ProcessRecord,
  appsByHandler: ReadonlyMap<HandlerId, NativeAppDefinition>,
): Pick<NativeTaskbarEntry, "appId" | "name" | "icon"> {
  const app = appsByHandler.get(process.handlerId);
  return app
    ? { appId: app.id, name: app.name, icon: app.icon }
    : { appId: process.appId, name: process.title, icon: process.icon };
}

function presentation(
  entry: TaskbarEntry,
  state: TaskbarPresentationState,
  statusLabel: string,
  options: Pick<TaskbarPresentation, "running" | "active" | "launching" | "uncertain">,
  badge?: string,
): TaskbarPresentation {
  const pinnedSuffix = entry.pinned && state !== "pinned-only" ? "; pinned to taskbar" : "";
  return {
    state,
    statusLabel,
    accessibilityLabel: `${entry.name}; ${statusLabel}${pinnedSuffix}`,
    ...options,
    ...(badge ? { badge } : {}),
  };
}

/**
 * Projects canonical Process/Windowing/Neutron observations into user-facing
 * taskbar state. It never stores or strengthens lifecycle knowledge: in
 * particular, an unknown Element runtime observation remains uncertain.
 */
export function deriveTaskbarPresentation(
  entry: TaskbarEntry,
  windows: readonly WindowState[] = [],
  busyTaskId: string | null = null,
): TaskbarPresentation {
  const busy = busyTaskId === entry.id;

  if (entry.kind === "native") {
    const processStarting = entry.process?.state === "starting";
    if (busy || processStarting) {
      return presentation(entry, "launching", "Launching", {
        running: entry.process?.state === "running",
        active: false,
        launching: true,
        uncertain: false,
      }, "…");
    }
    if (!entry.process) {
      return presentation(entry, "pinned-only", "Pinned to taskbar", {
        running: false,
        active: false,
        launching: false,
        uncertain: false,
      });
    }

    const targetWindow = windowForProcess(entry.process, windows);
    const active = !!targetWindow
      && !targetWindow.minimized
      && focusedWindow(windows)?.id === targetWindow.id;
    if (active) {
      return presentation(entry, "active", "Active and focused", {
        running: true,
        active: true,
        launching: false,
        uncertain: false,
      });
    }
    return presentation(entry, "running", "Running", {
      running: true,
      active: false,
      launching: false,
      uncertain: false,
    });
  }

  if (busy) {
    return presentation(entry, "launching", "Opening", {
      running: entry.running === "yes",
      active: false,
      launching: true,
      uncertain: entry.running === "unknown",
    }, "…");
  }
  if (entry.running === "yes") {
    return presentation(entry, "running", "Running", {
      running: true,
      active: false,
      launching: false,
      uncertain: false,
    });
  }
  if (entry.running === "unknown") {
    return presentation(entry, "uncertain", "Runtime status unavailable", {
      running: false,
      active: false,
      launching: false,
      uncertain: true,
    }, "?");
  }
  return presentation(entry, "pinned-only", "Pinned to taskbar", {
    running: false,
    active: false,
    launching: false,
    uncertain: false,
  });
}

/**
 * Derives the taskbar from pinned preferences and live service state only.
 * Installed-but-unpinned and not-running applications are intentionally absent.
 */
export function deriveTaskbarEntries(input: TaskbarModelInput): PresentedTaskbarEntry[] {
  const appsByHandler = new Map(input.nativeApps.map((app) => [app.handlerId, app] as const));
  const processesByHandler = new Map<HandlerId, ProcessRecord[]>();
  for (const process of input.processes) {
    if (process.state === "closing") continue;
    const group = processesByHandler.get(process.handlerId) ?? [];
    group.push(process);
    processesByHandler.set(process.handlerId, group);
  }

  const nativeHandlerOrder: HandlerId[] = [];
  const seenNative = new Set<HandlerId>();
  for (const handlerId of input.preferences.pinnedNative) {
    if (!seenNative.has(handlerId) && appsByHandler.has(handlerId)) {
      seenNative.add(handlerId);
      nativeHandlerOrder.push(handlerId);
    }
  }
  for (const process of input.processes) {
    if (process.state === "closing" || seenNative.has(process.handlerId)) continue;
    seenNative.add(process.handlerId);
    nativeHandlerOrder.push(process.handlerId);
  }

  const entries: TaskbarEntry[] = [];
  for (const handlerId of nativeHandlerOrder) {
    const running = processesByHandler.get(handlerId) ?? [];
    const pinned = input.preferences.pinnedNative.includes(handlerId);
    const app = appsByHandler.get(handlerId);

    if (running.length === 0) {
      if (!pinned || !app) continue;
      entries.push({
        kind: "native",
        id: `native:${handlerId}`,
        handlerId,
        appId: app.id,
        name: app.name,
        icon: app.icon,
        pinned: true,
        process: null,
      });
      continue;
    }

    // A single open instance merges with its pinned handler entry. Multiple
    // instances receive process-specific entries so distinct records are never
    // silently collapsed into one task.
    for (const process of running) {
      const metadata = nativeMetadataForProcess(process, appsByHandler);
      entries.push({
        kind: "native",
        id: running.length === 1 ? `native:${handlerId}` : `process:${process.id}`,
        handlerId,
        ...metadata,
        pinned,
        process,
      });
    }
  }

  const elementsById = new Map(input.elements.map((element) => [element.id, element] as const));
  const elementOrder: string[] = [];
  const seenElements = new Set<string>();
  for (const id of input.preferences.pinnedElements) {
    if (elementsById.has(id) && !seenElements.has(id)) {
      seenElements.add(id);
      elementOrder.push(id);
    }
  }
  for (const element of input.elements) {
    if (element.running !== "yes" || seenElements.has(element.id)) continue;
    seenElements.add(element.id);
    elementOrder.push(element.id);
  }

  for (const id of elementOrder) {
    const element = elementsById.get(id);
    if (!element) continue;
    entries.push({
      kind: "element",
      id: `element:${element.id}`,
      elementId: element.id,
      name: element.name,
      ...(element.icon ? { icon: element.icon } : {}),
      pinned: input.preferences.pinnedElements.includes(element.id),
      running: element.running,
    });
  }

  const windows = input.windows ?? [];
  const busyTaskId = input.busyTaskId ?? null;
  return entries.map((entry) => ({
    ...entry,
    presentation: deriveTaskbarPresentation(entry, windows, busyTaskId),
  }));
}

export type NativeTaskbarAction = "launch" | "focus" | "minimize";

export function windowForProcess(
  process: ProcessRecord,
  windows: readonly WindowState[],
): WindowState | null {
  if (process.windowId) {
    const exact = windows.find((window) => window.id === process.windowId);
    if (exact) return exact;
  }
  return windows.find((window) => window.processId === process.id) ?? null;
}

export function focusedWindow(windows: readonly WindowState[]): WindowState | null {
  let focused: WindowState | null = null;
  for (const window of windows) {
    if (window.minimized) continue;
    if (!focused || window.z > focused.z) focused = window;
  }
  return focused;
}

export function decideNativeTaskbarAction(
  entry: NativeTaskbarEntry,
  windows: readonly WindowState[],
): NativeTaskbarAction {
  if (!entry.process) return "launch";
  const targetWindow = windowForProcess(entry.process, windows);
  if (!targetWindow || targetWindow.minimized) return "focus";
  return focusedWindow(windows)?.id === targetWindow.id ? "minimize" : "focus";
}

export async function executeNativeTaskbarAction(
  entry: NativeTaskbarEntry,
  process: ProcessController,
  windows: WindowManager,
  target: OpenTarget = {},
): Promise<NativeTaskbarAction> {
  const action = decideNativeTaskbarAction(entry, windows.list());
  if (action === "launch") {
    await process.open(entry.handlerId, target);
  } else if (entry.process) {
    if (action === "focus") process.focus(entry.process.id);
    else {
      const targetWindow = windowForProcess(entry.process, windows.list());
      if (targetWindow) windows.minimize(targetWindow.id);
    }
  }
  return action;
}

export interface ExternalOpenResult {
  refreshError: unknown | null;
}

/** Refresh failure is bounded: it is reported but never turns unknown into no or blocks opening. */
export async function openExternalElement(
  bridge: NeutronBridge,
  appId: string,
): Promise<ExternalOpenResult> {
  let refreshError: unknown | null = null;
  try {
    await bridge.refreshRuntimeState();
  } catch (error: unknown) {
    refreshError = error;
  }
  await bridge.openElement(appId);
  return { refreshError };
}

export interface StartNativeEntry {
  kind: "native";
  id: string;
  handlerId: HandlerId;
  appId: string;
  name: string;
  icon: IconRef;
}

export interface StartElementEntry {
  kind: "element";
  id: string;
  elementId: string;
  name: string;
  icon?: string;
  description: string;
  running: ExternalRunning;
}

export type StartAppEntry = StartNativeEntry | StartElementEntry;

export function deriveStartEntries(
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): StartAppEntry[] {
  const entries: StartAppEntry[] = [
    ...nativeApps.map<StartNativeEntry>((app) => ({
      kind: "native",
      id: `native:${app.handlerId}`,
      handlerId: app.handlerId,
      appId: app.id,
      name: app.name,
      icon: app.icon,
    })),
    ...elements.map<StartElementEntry>((element) => ({
      kind: "element",
      id: `element:${element.id}`,
      elementId: element.id,
      name: element.name,
      ...(element.icon ? { icon: element.icon } : {}),
      description: element.description,
      running: element.running,
    })),
  ];
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterStartEntries(entries: readonly StartAppEntry[], query: string): StartAppEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...entries];
  return entries.filter((entry) => {
    const details = entry.kind === "element" ? entry.description : entry.appId;
    return `${entry.name}\n${details}`.toLocaleLowerCase().includes(needle);
  });
}

export interface TrayEntry {
  elementId: string;
  title: string;
  running: ExternalRunning;
}

/** Only the frozen vanilla tray declaration is surfaced. */
export function deriveTrayEntries(elements: readonly ExternalElement[]): TrayEntry[] {
  return elements.flatMap((element) => {
    const title = element.tray?.title;
    if (typeof title !== "string" || !title.trim()) return [];
    return [{ elementId: element.id, title, running: element.running }];
  });
}
