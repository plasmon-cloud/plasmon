import { expect, test } from "bun:test";
import type { ExternalElement, ShellPreferences } from "../src/os/contracts/index.ts";
import { deriveTaskbarEntries } from "../src/os/shell/model.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const preferences: ShellPreferences = {
  version: 1,
  pinnedNative: ["native:explorer"],
  pinnedElements: ["unknown-element"],
  themeId: "plasmon-dark",
  wallpaper: "aurora",
};
const unknownElement: ExternalElement = {
  id: "unknown-element",
  name: "Uncertain Element",
  description: "Runtime unavailable",
  tiles: [{ id: "main", title: "Main" }],
  running: "unknown",
};

function taskbar(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>) {
  return deriveTaskbarEntries({
    preferences,
    nativeApps: environment.services.nativeApps.list(),
    processes: environment.services.process.list(),
    elements: [unknownElement],
    windows: environment.services.windows.list(),
  });
}

test("taskbar projects the composed native lifecycle and preserves uncertain Element state", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [unknownElement] });
  try {
    expect(taskbar(environment).find((entry) => entry.kind === "native")?.presentation.state).toBe("pinned-only");
    expect(taskbar(environment).find((entry) => entry.kind === "element")?.presentation.state).toBe("uncertain");

    const explorer = await environment.services.process.open("native:explorer", {});
    expect(explorer).not.toBeNull();
    expect(taskbar(environment).find((entry) => entry.kind === "native")?.presentation.state).toBe("active");

    const text = await environment.services.process.open("native:text", {});
    expect(text).not.toBeNull();
    expect(taskbar(environment).find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("running");
    expect(taskbar(environment).find((entry) => entry.process?.id === text)?.presentation.state).toBe("active");
  } finally {
    environment.dispose();
  }
});

test("taskbar remains truthful through minimize, restore, close, and dirty-close veto", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const explorer = await environment.services.process.open("native:explorer", {});
    if (!explorer) throw new Error("Explorer did not open");
    const record = environment.services.process.list().find((candidate) => candidate.id === explorer);
    if (!record?.windowId) throw new Error("Explorer window identity unavailable");

    environment.services.windows.minimize(record.windowId);
    expect(taskbar(environment).find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("running");
    environment.services.process.focus(explorer);
    expect(taskbar(environment).find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("active");

    const dirty = await environment.services.process.open("native:text", {});
    if (!dirty) throw new Error("Text did not open");
    environment.services.process.registerCloseHandler(dirty, () => "prevent");
    expect(environment.services.process.close(dirty)).toBe(false);
    expect(environment.services.process.list().some((candidate) => candidate.id === dirty && candidate.state === "running")).toBe(true);
    expect(environment.services.windows.list().some((window) => window.processId === dirty)).toBe(true);
  } finally {
    environment.dispose();
  }
});

test("external window teardown reconciles before the next taskbar projection", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const processId = await environment.services.process.open("native:text", {});
    if (!processId) throw new Error("Text did not open");
    const window = environment.services.windows.list().find((candidate) => candidate.processId === processId);
    if (!window) throw new Error("Text window did not open");

    environment.services.windows.close(window.id);
    expect(environment.services.process.list().find((record) => record.id === processId)).toBeUndefined();
    expect(taskbar(environment).find((entry) => entry.process?.id === processId)).toBeUndefined();
  } finally {
    environment.dispose();
  }
});
