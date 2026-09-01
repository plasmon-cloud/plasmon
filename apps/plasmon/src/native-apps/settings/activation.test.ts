import { expect, test } from "bun:test";
import { NativeProcessController } from "../../os/process/controller.ts";
import { NativeApplicationRegistry } from "../../os/process/registry.ts";
import { NativeWindowManager } from "../../os/windowing/NativeWindowManager.ts";
import { settingsAppDefinition } from "../content-apps.ts";
import { activateSettings, SETTINGS_HANDLER_ID } from "./activation.ts";
import { settingsDestinationFromTarget } from "./model.ts";

test("Settings destination activation reuses one process, updates its target, and focuses its window", async () => {
  const registry = new NativeApplicationRegistry();
  registry.register(settingsAppDefinition);
  let nextWindowId = 0;
  const windows = new NativeWindowManager({
    idFactory: () => `window:settings:${++nextWindowId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  const process = new NativeProcessController(registry, windows);

  const genericProcessId = await process.open(SETTINGS_HANDLER_ID, {});
  expect(genericProcessId).not.toBeNull();
  const genericRecord = process.list().find((record) => record.id === genericProcessId);
  expect(genericRecord).toBeDefined();
  expect(settingsDestinationFromTarget(genericRecord!.target)).toBe("home");

  const personalizationProcessId = await activateSettings(process, "personalization");
  expect(personalizationProcessId).toBe(genericProcessId);
  expect(process.list()).toHaveLength(1);
  expect(settingsDestinationFromTarget(process.list()[0]!.target)).toBe("personalization");

  const taskbarProcessId = await activateSettings(process, "taskbar");
  expect(taskbarProcessId).toBe(genericProcessId);
  expect(process.list()).toHaveLength(1);
  expect(settingsDestinationFromTarget(process.list()[0]!.target)).toBe("taskbar");
  expect(windows.focusSnapshot().focusedId).toBe(process.list()[0]?.windowId);

  process.dispose();
  windows.dispose();
});
