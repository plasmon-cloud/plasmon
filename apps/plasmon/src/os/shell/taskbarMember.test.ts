// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type { ProcessRecord, WindowState } from "../contracts/index.ts";
import { deriveTaskbarMemberPresentation } from "./taskbarMember.ts";

function processRecord(state: ProcessRecord["state"] = "running"): ProcessRecord {
  return {
    id: "native:text#1",
    appId: "native:text",
    handlerId: "native:text",
    target: {},
    title: "Text Editor",
    icon: "text",
    state,
    windowId: "window:native:text#1",
  };
}

function windowState(process: ProcessRecord, minimized = false): WindowState {
  return {
    id: process.windowId ?? `window:${process.id}`,
    processId: process.id,
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    z: 2,
    minimized,
    maximized: false,
  };
}

test("group member presentation follows canonical Process and Windowing observations", () => {
  const running = processRecord();
  const window = windowState(running);
  expect(deriveTaskbarMemberPresentation(running, [window], window.id)).toMatchObject({
    state: "active",
    statusLabel: "Active",
    selectable: true,
  });
  expect(deriveTaskbarMemberPresentation(running, [{ ...window, minimized: true }], window.id)).toMatchObject({
    state: "minimized",
    statusLabel: "Minimized",
    selectable: true,
  });

  const starting = processRecord("starting");
  expect(deriveTaskbarMemberPresentation(starting, [], null)).toMatchObject({
    state: "launching",
    statusLabel: "Launching",
    selectable: false,
  });
});
