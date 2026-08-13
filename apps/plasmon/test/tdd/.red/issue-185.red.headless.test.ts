import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

test("Show Desktop toggles only eligible windows without destroying processes", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    const first = await environment.services.process.open("native:explorer", {});
    const second = await environment.services.process.open("native:text", {});
    if (!first || !second) throw new Error("native processes did not open");
    const before = environment.windows();
    const focused = before.at(-1)?.processId;
    const alreadyMinimized = environment.services.process.list().find((record) => record.id === first)?.windowId;
    if (!alreadyMinimized) throw new Error("first window identity unavailable");
    environment.services.windows.minimize(alreadyMinimized);

    const manager = environment.services.windows as typeof environment.services.windows & {
      showDesktop?: () => void;
      restoreDesktop?: () => void;
    };
    expect(typeof manager.showDesktop).toBe("function");
    manager.showDesktop!();
    expect(environment.services.process.list().map((record) => record.id)).toEqual([first, second]);
    expect(environment.windows().every((window) => window.minimized)).toBe(true);
    manager.restoreDesktop!();
    expect(environment.services.process.list()).toHaveLength(2);
    expect(environment.windows().find((window) => window.processId === first)?.minimized).toBe(true);
    expect(environment.windows().find((window) => window.processId === focused)?.minimized).toBe(false);
  } finally { environment.dispose(); }
});
