export {
  closeNativeTaskContextProcess,
  nativeTaskContextProcessId,
  placeShellContextMenu,
  placeTaskbarContextMenu,
  shellContextMenuHeight,
  taskbarContextMenuHeight,
  taskbarPinAction,
} from "./taskbar.ts";
export type {
  ShellContextAnchor,
  ShellContextMenuPosition,
  ShellContextMenuSize,
  ShellContextViewport,
  TaskbarContextAnchor,
  TaskbarContextMenuPosition,
  TaskbarContextMenuSize,
  TaskbarContextViewport,
  TaskbarPinAction,
} from "./taskbar.ts";

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

/** Shared first-party context ownership remains Shell policy; task-specific placement/actions live in taskbar.ts. */
export function resolveShellContextMenuPolicy(hit: ShellContextMenuHit): ShellContextMenuPolicy {
  if (!hit.shellOwned) return "none";
  if (hit.nativeTask) return "native-task";
  if (hit.elementTask) return "element-task";
  return "generic";
}
