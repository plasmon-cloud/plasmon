import type { ProcessId } from "../contracts/index.ts";
import type { ShellContextMenuPolicy } from "./interactions.ts";

export type ShellFlyout = "start" | "search" | "calendar" | "tray" | "settings" | null;

export type ShellContextMenuState = {
  x: number;
  y: number;
  policy: Exclude<ShellContextMenuPolicy, "none">;
  handlerId?: string;
  elementId?: string;
  processId?: ProcessId;
  taskbarBackground?: boolean;
} | null;

export interface ShellCoordinationState {
  flyout: ShellFlyout;
  contextMenu: ShellContextMenuState;
  openTaskbarGroupHandlerId: string | null;
}

export const INITIAL_SHELL_COORDINATION_STATE: ShellCoordinationState = Object.freeze({
  flyout: null,
  contextMenu: null,
  openTaskbarGroupHandlerId: null,
});

export type ShellCoordinationAction =
  | { type: "open-flyout"; flyout: Exclude<ShellFlyout, null> }
  | { type: "toggle-flyout"; flyout: Exclude<ShellFlyout, null> }
  | { type: "dismiss-flyout" }
  | { type: "set-context-menu"; contextMenu: Exclude<ShellContextMenuState, null> }
  | { type: "dismiss-context-menu" }
  | { type: "toggle-taskbar-group"; handlerId: string }
  | { type: "dismiss-taskbar-group" }
  | { type: "dismiss-transient" };

/**
 * Pure policy for mutually exclusive Shell-owned transient surfaces.
 * Process, Windowing, Search, Start and persistence state remain external.
 */
export function reduceShellCoordination(
  state: ShellCoordinationState,
  action: ShellCoordinationAction,
): ShellCoordinationState {
  switch (action.type) {
    case "open-flyout":
      return { flyout: action.flyout, contextMenu: null, openTaskbarGroupHandlerId: null };
    case "toggle-flyout":
      return {
        flyout: state.flyout === action.flyout ? null : action.flyout,
        contextMenu: null,
        openTaskbarGroupHandlerId: null,
      };
    case "dismiss-flyout":
      return { ...state, flyout: null };
    case "set-context-menu":
      return { ...state, contextMenu: action.contextMenu, openTaskbarGroupHandlerId: null };
    case "dismiss-context-menu":
      return { ...state, contextMenu: null };
    case "toggle-taskbar-group":
      return {
        flyout: null,
        contextMenu: null,
        openTaskbarGroupHandlerId: state.openTaskbarGroupHandlerId === action.handlerId ? null : action.handlerId,
      };
    case "dismiss-taskbar-group":
      return { ...state, openTaskbarGroupHandlerId: null };
    case "dismiss-transient":
      return INITIAL_SHELL_COORDINATION_STATE;
  }
}
