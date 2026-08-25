// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type { ExternalElement, HandlerId } from "../src/os/contracts/index.ts";
import {
  deriveTaskbarEntries,
  executeNativeTaskbarAction,
  type NativeTaskbarEntry,
  type PresentedTaskbarEntry,
} from "../src/os/shell/model.ts";
import type { ShellPreferences } from "../src/os/shell/preferences.ts";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "./headlessEnvironment.ts";

const uncertainElement: ExternalElement = {
  id: "taskbar-unknown",
  name: "Runtime Unknown",
  description: "Representative Neutron Element with unavailable runtime status.",
  tiles: [{ id: "main", title: "Main" }],
  running: "unknown",
};

function preferences(handlerId: HandlerId): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [handlerId],
    pinnedElements: [uncertainElement.id],
    themeId: "plasmon-dark",
    wallpaper: "aurora",
  };
}

async function projection(
  env: HeadlessPlasmonEnvironment,
  shellPreferences: ShellPreferences,
): Promise<PresentedTaskbarEntry[]> {
  return deriveTaskbarEntries({
    preferences: shellPreferences,
    nativeApps: env.services.nativeApps.list(),
    processes: env.services.process.list(),
    elements: await env.neutron.loadElements(),
    windows: env.services.windows.list(),
    focusedWindowId: env.services.windows.focusSnapshot().focusedId,
  });
}

function nativeEntry(
  entries: readonly PresentedTaskbarEntry[],
  handlerId: HandlerId,
): NativeTaskbarEntry & PresentedTaskbarEntry {
  const entry = entries.find(
    (candidate) => candidate.kind === "native" && candidate.handlerId === handlerId,
  );
  if (!entry || entry.kind !== "native") {
    throw new Error(`Expected taskbar entry for ${handlerId}`);
  }
  return entry;
}

function elementEntry(entries: readonly PresentedTaskbarEntry[]): PresentedTaskbarEntry {
  const entry = entries.find(
    (candidate) => candidate.kind === "element" && candidate.elementId === uncertainElement.id,
  );
  if (!entry) throw new Error("Expected representative Neutron Element taskbar entry");
  return entry;
}

test("headless taskbar follows canonical Process and Windowing lifecycle", async () => {
  const env = createHeadlessPlasmonEnvironment({ elements: [uncertainElement] });
  await env.ready;

  try {
    const primary = env.services.nativeApps.getByHandler("native:settings");
    const secondary = env.services.nativeApps.getByHandler("native:browser");
    if (!primary || !secondary) throw new Error("Expected core native applications");
    const shellPreferences = preferences(primary.handlerId);

    let entries = await projection(env, shellPreferences);
    let task = nativeEntry(entries, primary.handlerId);
    expect(task.pinned).toBe(true);
    expect(task.members).toHaveLength(0);
    expect(task.presentation).toMatchObject({
      state: "pinned-only",
      running: false,
      active: false,
    });

    const uncertain = elementEntry(entries);
    expect(uncertain.kind).toBe("element");
    expect(uncertain.presentation).toMatchObject({
      state: "uncertain",
      running: false,
      uncertain: true,
      statusLabel: "Runtime status unavailable",
    });

    expect(
      await executeNativeTaskbarAction(task, env.services.process, env.services.windows),
    ).toBe("launch");

    entries = await projection(env, shellPreferences);
    task = nativeEntry(entries, primary.handlerId);
    expect(task.members).toHaveLength(1);
    expect(task.presentation).toMatchObject({ state: "active", running: true, active: true });
    const primaryProcess = task.members[0]!;
    if (!primaryProcess.windowId) throw new Error("Expected launched process window");
    const primaryWindowId = primaryProcess.windowId;

    await env.services.process.open(secondary.handlerId, {});
    entries = await projection(env, shellPreferences);
    task = nativeEntry(entries, primary.handlerId);
    expect(task.presentation).toMatchObject({ state: "running", running: true, active: false });

    expect(
      await executeNativeTaskbarAction(task, env.services.process, env.services.windows),
    ).toBe("focus");
    task = nativeEntry(await projection(env, shellPreferences), primary.handlerId);
    expect(task.presentation).toMatchObject({ state: "active", running: true, active: true });

    expect(
      await executeNativeTaskbarAction(task, env.services.process, env.services.windows),
    ).toBe("minimize");
    expect(env.services.windows.list().find((window) => window.id === primaryWindowId)?.minimized).toBe(true);
    task = nativeEntry(await projection(env, shellPreferences), primary.handlerId);
    expect(task.presentation).toMatchObject({ state: "running", running: true, active: false });

    expect(
      await executeNativeTaskbarAction(task, env.services.process, env.services.windows),
    ).toBe("focus");
    expect(env.services.windows.list().find((window) => window.id === primaryWindowId)?.minimized).toBe(false);
    expect(env.services.windows.focusSnapshot().focusedId).toBe(primaryWindowId);
    task = nativeEntry(await projection(env, shellPreferences), primary.handlerId);
    expect(task.presentation).toMatchObject({ state: "active", running: true, active: true });

    expect(env.services.process.close(primaryProcess.id)).toBe(true);
    task = nativeEntry(await projection(env, shellPreferences), primary.handlerId);
    expect(task.pinned).toBe(true);
    expect(task.members).toHaveLength(0);
    expect(task.presentation).toMatchObject({
      state: "pinned-only",
      running: false,
      active: false,
    });
  } finally {
    env.dispose();
  }
});

test("external window teardown reconciles Process before the next taskbar projection", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;

  try {
    const app = env.services.nativeApps.getByHandler("native:settings");
    if (!app) throw new Error("Expected Settings native application");
    const shellPreferences = preferences(app.handlerId);

    const processId = await env.services.process.open(app.handlerId, {});
    if (!processId) throw new Error("Expected native process launch");
    const process = env.services.process.list().find((candidate) => candidate.id === processId);
    if (!process?.windowId) throw new Error("Expected launched process window");

    const running = nativeEntry(await projection(env, shellPreferences), app.handlerId);
    expect(running.members.map((member) => member.id)).toEqual([processId]);
    expect(running.presentation.running).toBe(true);

    env.services.windows.close(process.windowId);

    expect(env.services.process.list().some((candidate) => candidate.id === processId)).toBe(false);
    const reconciled = nativeEntry(await projection(env, shellPreferences), app.handlerId);
    expect(reconciled.pinned).toBe(true);
    expect(reconciled.members).toHaveLength(0);
    expect(reconciled.presentation).toMatchObject({
      state: "pinned-only",
      running: false,
      active: false,
    });
  } finally {
    env.dispose();
  }
});
