// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

test("taskbar preferences persist across production recomposition without rewriting Process or Window identity", async () => {
  const first = createHeadlessPlasmonEnvironment();
  await first.ready;

  try {
    await first.services.shellPreferences.load();
    await first.os.open("/System/Settings.sys");

    const processesBefore = first.os.processes.list().map((process) => ({
      id: process.id,
      handlerId: process.handlerId,
      windowId: process.windowId,
      state: process.state,
    }));
    const windowsBefore = first.os.windows.list().map((window) => ({
      id: window.id,
      processId: window.processId,
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
      minimized: window.minimized,
      maximized: window.maximized,
    }));
    expect(processesBefore.some((process) => process.handlerId === "native:settings")).toBe(true);
    expect(windowsBefore).not.toHaveLength(0);

    const outcome = await first.services.shellPreferences.save({
      ...first.services.shellPreferences.getSnapshot(),
      taskbarAlignment: "left",
      taskbarPlacement: "top",
      taskbarIconSize: "large",
      showNeutronTray: false,
    });
    expect(outcome.saved).toBe(true);
    expect(first.os.processes.list().map((process) => ({
      id: process.id,
      handlerId: process.handlerId,
      windowId: process.windowId,
      state: process.state,
    }))).toEqual(processesBefore);
    expect(first.os.windows.list().map((window) => ({
      id: window.id,
      processId: window.processId,
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
      minimized: window.minimized,
      maximized: window.maximized,
    }))).toEqual(windowsBefore);

    const repository = first.repository;
    first.dispose();

    const second = createHeadlessPlasmonEnvironment({ repository });
    await second.ready;
    try {
      const restored = await second.services.shellPreferences.load();
      expect(restored.taskbarAlignment).toBe("left");
      expect(restored.taskbarPlacement).toBe("top");
      expect(restored.taskbarIconSize).toBe("large");
      expect(restored.showNeutronTray).toBe(false);
    } finally {
      second.dispose();
    }
  } finally {
    // dispose() is idempotent for the first environment after persistence proof.
    first.dispose();
  }
});
