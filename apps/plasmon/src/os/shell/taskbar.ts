import type {
  ExternalElement,
  HandlerId,
  IconRef,
  NativeAppDefinition,
  OpenTarget,
  ProcessController,
  ProcessId,
  ProcessRecord,
  WindowManager,
  WindowState,
} from "../contracts/index.ts";
import type { ShellPreferences } from "./preferences.ts";

export interface NativeTaskbarEntry {
  kind: "native";
  id: string;
  handlerId: HandlerId;
  appId: string;
  name: string;
  icon: IconRef;
  pinned: boolean;
  members: readonly ProcessRecord[];
}

export interface ElementTaskbarEntry {
  kind: "element";
  id: string;
  elementId: string;
  name: string;
  icon?: string;
  pinned: boolean;
  running: ExternalElement["running"];
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

/**
 * Canonical observations consumed by the taskbar projection. The taskbar owns
 * none of these records: Process remains lifecycle authority, WindowManager
 * remains focus/minimize/restore authority, and preferences remain pin/order
 * authority.
 */
export interface TaskbarProjectionInput {
  preferences: ShellPreferences;
  nativeApps: readonly NativeAppDefinition[];
  processes: readonly ProcessRecord[];
  elements: readonly ExternalElement[];
  windows?: readonly WindowState[];
  focusedWindowId?: WindowState["id"] | null;
  busyTaskId?: string | null;
}

/** Compatibility name retained while Shell migrates to the focused projection module. */
export type TaskbarModelInput = TaskbarProjectionInput;

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

/** Resolve only the canonical WindowManager focus snapshot against live windows. */
export function focusedWindow(
  windows: readonly WindowState[],
  focusedWindowId: WindowState["id"] | null,
): WindowState | null {
  if (!focusedWindowId) return null;
  return windows.find((window) => window.id === focusedWindowId && !window.minimized) ?? null;
}

/**
 * Projects canonical Process/Windowing/Neutron observations into user-facing
 * taskbar state. It never stores or strengthens lifecycle knowledge: unknown
 * Element runtime observation remains uncertain and z-order is never treated
 * as substitute focus authority.
 */
export function deriveTaskbarPresentation(
  entry: TaskbarEntry,
  windows: readonly WindowState[] = [],
  busyTaskId: string | null = null,
  focusedWindowId: WindowState["id"] | null = null,
): TaskbarPresentation {
  const busy = busyTaskId === entry.id;

  if (entry.kind === "native") {
    const runningMembers = entry.members.filter((member) => member.state === "running");
    if (runningMembers.length > 0) {
      const active = runningMembers.some((member) => {
        const targetWindow = windowForProcess(member, windows);
        return !!targetWindow && !targetWindow.minimized && focusedWindowId === targetWindow.id;
      });
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

    const processStarting = entry.members.some((member) => member.state === "starting");
    if (busy || processStarting) {
      return presentation(entry, "launching", "Launching", {
        running: false,
        active: false,
        launching: true,
        uncertain: false,
      }, "…");
    }
    return presentation(entry, "pinned-only", "Pinned to taskbar", {
      running: false,
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
 * Build one deterministic taskbar projection from canonical pin/application/
 * process/window identities. Installed-but-unpinned and stopped applications
 * are intentionally absent; no second running-app inventory is retained.
 */
export function deriveTaskbarProjection(input: TaskbarProjectionInput): PresentedTaskbarEntry[] {
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
    const members = processesByHandler.get(handlerId) ?? [];
    const pinned = input.preferences.pinnedNative.includes(handlerId);
    const app = appsByHandler.get(handlerId);
    const firstMember = members[0];
    if (!app && !firstMember) continue;
    const metadata = app
      ? { appId: app.id, name: app.name, icon: app.icon }
      : nativeMetadataForProcess(firstMember!, appsByHandler);

    entries.push({
      kind: "native",
      id: `native:${handlerId}`,
      handlerId,
      ...metadata,
      pinned,
      members,
    });
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
  const focusedWindowId = input.focusedWindowId ?? null;
  const busyTaskId = input.busyTaskId ?? null;
  return entries.map((entry) => ({
    ...entry,
    presentation: deriveTaskbarPresentation(entry, windows, busyTaskId, focusedWindowId),
  }));
}

/** Compatibility name for existing Shell callers; the implementation lives here. */
export function deriveTaskbarEntries(input: TaskbarProjectionInput): PresentedTaskbarEntry[] {
  return deriveTaskbarProjection(input);
}

export type NativeTaskbarAction = "launch" | "focus" | "minimize" | "choose";

export function decideNativeTaskbarAction(
  entry: NativeTaskbarEntry,
  windows: readonly WindowState[],
  focusedWindowId: WindowState["id"] | null = null,
): NativeTaskbarAction {
  if (entry.members.length === 0) return "launch";
  if (entry.members.length > 1) return "choose";
  const member = entry.members[0]!;
  const targetWindow = windowForProcess(member, windows);
  if (!targetWindow || targetWindow.minimized) return "focus";
  return focusedWindowId === targetWindow.id ? "minimize" : "focus";
}

/** Translate taskbar intent only into canonical Process/WindowManager commands. */
export async function executeNativeTaskbarAction(
  entry: NativeTaskbarEntry,
  process: ProcessController,
  windows: WindowManager,
  target: OpenTarget = {},
): Promise<NativeTaskbarAction> {
  const action = decideNativeTaskbarAction(entry, windows.list(), windows.focusSnapshot().focusedId);
  if (action === "launch") {
    await process.open(entry.handlerId, target);
  } else if (action === "focus") {
    const member = entry.members[0];
    if (member) process.focus(member.id);
  } else if (action === "minimize") {
    const member = entry.members[0];
    if (member) {
      const targetWindow = windowForProcess(member, windows.list());
      if (targetWindow) windows.minimize(targetWindow.id);
    }
  }
  return action;
}

/** Group-member selection delegates through Process authority, never Shell state. */
export function focusNativeTaskbarMember(
  entry: NativeTaskbarEntry,
  memberId: ProcessRecord["id"],
  process: ProcessController,
): boolean {
  const member = entry.members.find((candidate) => candidate.id === memberId);
  if (!member || member.state !== "running") return false;
  process.focus(member.id);
  return true;
}

export interface TaskbarContextAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TaskbarContextViewport {
  width: number;
  height: number;
}

export interface TaskbarContextMenuSize {
  width: number;
  height: number;
}

export interface TaskbarContextMenuPosition {
  x: number;
  y: number;
}

/** Compatibility type aliases retained for the current Shell render boundary. */
export type ShellContextAnchor = TaskbarContextAnchor;
export type ShellContextViewport = TaskbarContextViewport;
export type ShellContextMenuSize = TaskbarContextMenuSize;
export type ShellContextMenuPosition = TaskbarContextMenuPosition;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/** Mirrors the taskbar menu presentation contract: panel padding, rows, gaps, border. */
export function taskbarContextMenuHeight(itemCountInput: number): number {
  const itemCount = Math.max(1, Math.floor(finite(itemCountInput, 1)));
  return 18 + itemCount * 48 + (itemCount - 1) * 5;
}

export const shellContextMenuHeight = taskbarContextMenuHeight;

/**
 * Place a taskbar context surface adjacent to its source while bounding the
 * complete menu to the viewport. Browser geometry is sampled by Shell; this
 * pure policy owns no DOM state.
 */
export function placeTaskbarContextMenu(
  anchorInput: TaskbarContextAnchor,
  viewportInput: TaskbarContextViewport,
  menuInput: TaskbarContextMenuSize,
  options: { gap?: number; margin?: number } = {},
): TaskbarContextMenuPosition {
  const margin = Math.max(0, finite(options.margin ?? 8, 8));
  const gap = Math.max(0, finite(options.gap ?? 6, 6));
  const viewport = {
    width: Math.max(1, finite(viewportInput.width, 1)),
    height: Math.max(1, finite(viewportInput.height, 1)),
  };
  const menu = {
    width: Math.max(1, finite(menuInput.width, 1)),
    height: Math.max(1, finite(menuInput.height, 1)),
  };
  const anchor = {
    left: finite(anchorInput.left),
    top: finite(anchorInput.top),
    width: Math.max(0, finite(anchorInput.width)),
    height: Math.max(0, finite(anchorInput.height)),
  };

  const maxX = viewport.width - menu.width - margin;
  const maxY = viewport.height - menu.height - margin;
  const centeredX = anchor.left + anchor.width / 2 - menu.width / 2;
  const aboveY = anchor.top - gap - menu.height;
  const belowY = anchor.top + anchor.height + gap;
  const canFitAbove = aboveY >= margin;
  const canFitBelow = belowY + menu.height <= viewport.height - margin;
  const preferredY = canFitAbove || !canFitBelow ? aboveY : belowY;

  return {
    x: clamp(centeredX, margin, maxX),
    y: clamp(preferredY, margin, maxY),
  };
}

export const placeShellContextMenu = placeTaskbarContextMenu;

/** App-scoped multi-member groups must never guess which process Close means. */
export function nativeTaskContextProcessId(
  members: readonly Pick<{ id: ProcessId }, "id">[],
): ProcessId | null {
  return members.length === 1 ? members[0]!.id : null;
}

/** Ordinary Close delegates only through negotiable Process lifecycle authority. */
export function closeNativeTaskContextProcess(
  process: Pick<ProcessController, "close">,
  processId: ProcessId | null | undefined,
): boolean {
  return processId ? process.close(processId) : false;
}

export interface TaskbarPinAction {
  pinned: boolean;
  nextPinned: boolean;
  label: "Pin to taskbar" | "Unpin from taskbar";
}

export function taskbarPinAction(pinned: boolean): TaskbarPinAction {
  return pinned
    ? { pinned: true, nextPinned: false, label: "Unpin from taskbar" }
    : { pinned: false, nextPinned: true, label: "Pin to taskbar" };
}
