import type { ProcessController, ProcessId } from "../contracts/index.ts";

export interface ShellDismissHit {
  insideFlyout: boolean;
  insideToggle: boolean;
  insideContextMenu: boolean;
}

export function shouldDismissShellFlyout(open: boolean, hit: ShellDismissHit): boolean {
  return open && !hit.insideFlyout && !hit.insideToggle && !hit.insideContextMenu;
}

export function shouldDismissAfterResultActivation(succeeded: boolean): boolean {
  return succeeded;
}

export type ShellContextMenuPolicy = "none" | "generic" | "native-task" | "element-task";

export interface ShellContextMenuHit {
  shellOwned: boolean;
  nativeTask: boolean;
  elementTask: boolean;
}

/** Specialized task menus outrank the generic Shell fallback. */
export function resolveShellContextMenuPolicy(hit: ShellContextMenuHit): ShellContextMenuPolicy {
  if (!hit.shellOwned) return "none";
  if (hit.nativeTask) return "native-task";
  if (hit.elementTask) return "element-task";
  return "generic";
}

export interface ShellContextAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ShellContextViewport {
  width: number;
  height: number;
}

export interface ShellContextMenuSize {
  width: number;
  height: number;
}

export interface ShellContextMenuPosition {
  x: number;
  y: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/** Mirrors the Shell menu presentation contract: 8px panel padding, 48px rows, 5px row gaps, 1px border. */
export function shellContextMenuHeight(itemCountInput: number): number {
  const itemCount = Math.max(1, Math.floor(finite(itemCountInput, 1)));
  return 18 + itemCount * 48 + (itemCount - 1) * 5;
}

/**
 * Places a taskbar context surface adjacent to its invoking item/point while
 * keeping the complete menu inside the viewport. Bottom-anchored taskbar
 * sources prefer the space above and fall back below only when needed.
 */
export function placeShellContextMenu(
  anchorInput: ShellContextAnchor,
  viewportInput: ShellContextViewport,
  menuInput: ShellContextMenuSize,
  options: { gap?: number; margin?: number } = {},
): ShellContextMenuPosition {
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

/** App-scoped multi-member groups must never guess which process Close means. */
export function nativeTaskContextProcessId(
  members: readonly Pick<{ id: ProcessId }, "id">[],
): ProcessId | null {
  return members.length === 1 ? members[0]!.id : null;
}

/** Ordinary Close always delegates through the negotiable Process lifecycle. */
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
