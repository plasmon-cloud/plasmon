import { expect, test } from "bun:test";
import { enterWorkspaceExpand, exitWorkspaceExpand, type WorkspaceWindowControl } from "./workspaceExpand.ts";

function windowControl(maximized = false) {
  const calls = { maximize: 0, restore: 0 };
  const control: WorkspaceWindowControl = {
    maximized,
    maximize() {
      calls.maximize += 1;
      control.maximized = true;
    },
    restore() {
      calls.restore += 1;
      control.maximized = false;
    },
  };
  return { control, calls };
}

test("Photos workspace expand maximizes a floating window and restores only its own transition", () => {
  const { control, calls } = windowControl(false);
  const session = enterWorkspaceExpand(control);

  expect(session).toEqual({ maximizedByExpand: true });
  expect(control.maximized).toBe(true);
  expect(calls.maximize).toBe(1);

  exitWorkspaceExpand(control, session);
  expect(control.maximized).toBe(false);
  expect(calls.restore).toBe(1);
});

test("Photos workspace expand preserves a window that was already maximized", () => {
  const { control, calls } = windowControl(true);
  const session = enterWorkspaceExpand(control);

  expect(session).toEqual({ maximizedByExpand: false });
  expect(calls.maximize).toBe(0);

  exitWorkspaceExpand(control, session);
  expect(control.maximized).toBe(true);
  expect(calls.restore).toBe(0);
});

test("Photos does not issue a second restore after Windowing already left maximized state", () => {
  const { control, calls } = windowControl(false);
  const session = enterWorkspaceExpand(control);
  control.maximized = false;

  exitWorkspaceExpand(control, session);
  expect(calls.restore).toBe(0);
});
