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
