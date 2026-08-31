import type { ShellPreferences, ShellTaskbarIconSize, ShellTaskbarPlacement } from "./preferences.ts";

export const TASKBAR_ICON_PIXELS = Object.freeze({
  small: 26,
  medium: 34,
  large: 40,
} satisfies Readonly<Record<ShellTaskbarIconSize, number>>);

export interface ShellTaskbarLayout {
  placement: ShellTaskbarPlacement;
  workspaceInsetTop: boolean;
  workspaceInsetBottom: boolean;
  flyoutEdge: ShellTaskbarPlacement;
  taskIconSize: ShellTaskbarIconSize;
  taskIconPixels: number;
  showNeutronTray: boolean;
}

/**
 * Pure Shell-owned derivation from the canonical preference snapshot to the
 * rendered horizontal taskbar contract. Windowing consumes the resulting
 * workspace size through WindowLayer; this model never owns window geometry.
 */
export function deriveShellTaskbarLayout(preferences: ShellPreferences): ShellTaskbarLayout {
  const placement = preferences.taskbarPlacement;
  const taskIconSize = preferences.taskbarIconSize;
  return {
    placement,
    workspaceInsetTop: placement === "top",
    workspaceInsetBottom: placement === "bottom",
    flyoutEdge: placement,
    taskIconSize,
    taskIconPixels: TASKBAR_ICON_PIXELS[taskIconSize],
    showNeutronTray: preferences.showNeutronTray,
  };
}
