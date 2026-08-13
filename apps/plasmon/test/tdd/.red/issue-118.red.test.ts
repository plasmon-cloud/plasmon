import { expect, test } from "bun:test";
import type { NativeAppDefinition, ProcessRecord } from "../../../src/os/contracts/index.ts";
import { deriveTaskbarEntries } from "../../../src/os/shell/model.ts";
import type { ShellPreferences } from "../../../src/os/shell/preferences.ts";

const text: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text Editor",
  icon: "text",
  defaultWindow: { width: 700, height: 500 },
  associations: [],
};

const preferences: ShellPreferences = {
  version: 1,
  pinnedNative: ["native:text"],
  pinnedElements: [],
  themeId: "plasmon-dark",
  wallpaper: "aurora",
};

function process(id: string): ProcessRecord {
  return {
    id,
    appId: "native:text",
    handlerId: "native:text",
    target: {},
    title: `Text ${id}`,
    icon: "text",
    state: "running",
    windowId: `window:${id}`,
  };
}

test("multiple native processes project as one application taskbar group", () => {
  const entries = deriveTaskbarEntries({
    preferences,
    nativeApps: [text],
    processes: [process("native:text#1"), process("native:text#2")],
    elements: [],
  });

  // Grouping must retain both process/window switch targets in the group;
  // emitting one unrelated button per process is the current defect.
  expect(entries.filter((entry) => entry.kind === "native")).toHaveLength(1);
});
