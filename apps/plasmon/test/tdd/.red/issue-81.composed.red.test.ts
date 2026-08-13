import { expect, test } from "bun:test";
import type { ExternalElement, ShellPreferences } from "../../../src/os/contracts/index.ts";
import { deriveTaskbarEntries } from "../../../src/os/shell/model.ts";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

const prefs: ShellPreferences = {
  version: 1,
  pinnedNative: ["native:explorer"],
  pinnedElements: ["unknown-element"],
  themeId: "plasmon-dark",
  wallpaper: "aurora",
};
const unknownElement: ExternalElement = {
  id: "unknown-element", name: "Uncertain Element", description: "Runtime unavailable",
  tiles: [{ id: "main", title: "Main" }], running: "unknown",
};
function projection(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>) {
  return deriveTaskbarEntries({
    preferences: prefs, nativeApps: environment.services.nativeApps.list(),
    processes: environment.services.process.list(), elements: [unknownElement],
    windows: environment.services.windows.list(),
  });
}

test("composed taskbar lifecycle projects canonical Process and Windowing transitions", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [unknownElement] });
  try {
    expect(projection(environment).find((entry) => entry.kind === "native")?.presentation.state).toBe("pinned-only");
    expect(projection(environment).find((entry) => entry.kind === "element")?.presentation.state).toBe("uncertain");

    const explorer = await environment.services.process.open("native:explorer", {});
    expect(explorer).not.toBeNull();
    expect(projection(environment).find((entry) => entry.kind === "native")?.presentation.state).toBe("active");

    const text = await environment.services.process.open("native:text", {});
    expect(text).not.toBeNull();
    const native = projection(environment).filter((entry) => entry.kind === "native");
    expect(native.find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("running");
    expect(native.find((entry) => entry.process?.id === text)?.presentation.state).toBe("active");

    const explorerRecord = environment.services.process.list().find((record) => record.id === explorer);
    if (!explorerRecord?.windowId) throw new Error("Explorer window identity unavailable");
    environment.services.windows.minimize(explorerRecord.windowId);
    expect(projection(environment).find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("running");
    environment.services.process.focus(explorer!);
    expect(projection(environment).find((entry) => entry.process?.id === explorer)?.presentation.state).toBe("active");

    expect(environment.services.process.close(explorer!)).toBe(true);
    const afterClose = projection(environment);
    expect(afterClose.find((entry) => entry.process?.id === explorer)).toBeUndefined();
    expect(afterClose.find((entry) => entry.kind === "native" && entry.id === "native:native:explorer")?.presentation.state).toBe("pinned-only");
  } finally { environment.dispose(); }
});

test("a dirty native document close veto preserves taskbar running state", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const id = await environment.services.process.open("native:text", {});
    if (!id) throw new Error("Text process did not open");
    let closeAttempts = 0;
    environment.services.process.registerCloseHandler(id, () => { closeAttempts += 1; return "prevent"; });
    expect(environment.services.process.close(id)).toBe(false);
    expect(closeAttempts).toBe(1);
    expect(environment.services.process.list().some((record) => record.id === id && record.state === "running")).toBe(true);
    expect(environment.services.windows.list().some((window) => window.processId === id)).toBe(true);
  } finally { environment.dispose(); }
});

test("stale window cleanup removes its process before taskbar projection", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const id = await environment.services.process.open("native:text", {});
    const window = environment.services.windows.list().find((candidate) => candidate.processId === id);
    if (!id || !window) throw new Error("Text process/window did not open");
    environment.services.windows.close(window.id);
    expect(environment.services.process.list().find((record) => record.id === id)).toBeUndefined();
    expect(deriveTaskbarEntries({
      preferences: { ...prefs, pinnedNative: [] }, nativeApps: environment.services.nativeApps.list(),
      processes: environment.services.process.list(), elements: [], windows: environment.services.windows.list(),
    }).find((entry) => entry.kind === "native" && entry.process?.id === id)).toBeUndefined();
  } finally { environment.dispose(); }
});
