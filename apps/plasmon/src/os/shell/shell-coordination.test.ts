import { describe, expect, test } from "bun:test";
import {
  INITIAL_SHELL_COORDINATION_STATE,
  reduceShellCoordination,
  type ShellCoordinationState,
} from "./shell-coordination.ts";

const contextMenu = {
  x: 20,
  y: 30,
  policy: "shell" as const,
};

describe("Shell transient coordination", () => {
  test("opening a flyout dismisses competing transient surfaces", () => {
    const state: ShellCoordinationState = {
      flyout: "start",
      contextMenu,
      openTaskbarGroupHandlerId: "native:files",
    };

    expect(reduceShellCoordination(state, { type: "open-flyout", flyout: "search" })).toEqual({
      flyout: "search",
      contextMenu: null,
      openTaskbarGroupHandlerId: null,
    });
  });

  test("toggle preserves the one-active-flyout contract", () => {
    const opened = reduceShellCoordination(INITIAL_SHELL_COORDINATION_STATE, { type: "toggle-flyout", flyout: "calendar" });
    expect(opened.flyout).toBe("calendar");
    expect(reduceShellCoordination(opened, { type: "toggle-flyout", flyout: "calendar" }).flyout).toBeNull();
  });

  test("taskbar groups and context menus remain mutually exclusive with flyouts", () => {
    const flyout = reduceShellCoordination(INITIAL_SHELL_COORDINATION_STATE, { type: "open-flyout", flyout: "settings" });
    const grouped = reduceShellCoordination(flyout, { type: "toggle-taskbar-group", handlerId: "native:files" });
    expect(grouped).toEqual({ flyout: null, contextMenu: null, openTaskbarGroupHandlerId: "native:files" });

    const contextual = reduceShellCoordination(grouped, { type: "set-context-menu", contextMenu });
    expect(contextual.flyout).toBeNull();
    expect(contextual.openTaskbarGroupHandlerId).toBeNull();
    expect(contextual.contextMenu).toEqual(contextMenu);
  });

  test("global dismissal clears only Shell-owned transient coordination", () => {
    const state: ShellCoordinationState = {
      flyout: "tray",
      contextMenu,
      openTaskbarGroupHandlerId: "native:files",
    };
    expect(reduceShellCoordination(state, { type: "dismiss-transient" })).toEqual(INITIAL_SHELL_COORDINATION_STATE);
  });
});
