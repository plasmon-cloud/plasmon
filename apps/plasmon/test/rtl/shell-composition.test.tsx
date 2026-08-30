import { expect, test } from "bun:test";
import { within } from "@testing-library/react";
import type { ExternalElement } from "../../src/os/contracts/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const trayElement: ExternalElement = {
  id: "status-element",
  name: "Status Element",
  description: "Provides one test tray declaration.",
  version: 1,
  tiles: [{ id: "main", title: "Status" }],
  tray: { title: "Status tray" },
  running: "yes",
};

test("Shell composes calendar and tray coordination with canonical Settings activation", async () => {
  const app = await renderPlasmon({ elements: [trayElement] });

  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    const trayButton = within(taskbar).getByRole("button", { name: "Neutron trays; 1 declared" });
    await app.user.click(trayButton);
    expect(await app.findByRole("region", { name: "Neutron trays" })).toBeDefined();

    const clockButton = within(taskbar).getByRole("button", { name: /^Clock and calendar,/ });
    await app.user.click(clockButton);
    const calendar = await app.findByRole("region", { name: "Clock and calendar" });
    expect(app.queryByRole("region", { name: "Neutron trays" })).toBeNull();
    expect(within(calendar).getByRole("button", { name: "Previous month" })).toBeDefined();
    expect(within(calendar).getByRole("button", { name: "Next month" })).toBeDefined();

    const startButton = within(taskbar).getByRole("button", { name: "Start" });
    await app.user.pointer({ target: startButton, keys: "[MouseRight]" });
    const contextMenu = await app.findByRole("menu", { name: "Shell context menu" });
    await app.user.click(within(contextMenu).getByRole("menuitem", { name: "Settings" }));

    const settings = await app.findByRole("region", { name: "Settings" });
    expect(app.queryByRole("region", { name: "Clock and calendar" })).toBeNull();
    expect(app.queryByRole("region", { name: "Shell settings" })).toBeNull();
    const capabilityHeadings = [
      "Storage",
      "Files & Explorer",
      "Appearance",
      "File associations",
      "Backup & sharing",
    ];
    for (const heading of capabilityHeadings) {
      expect(within(settings).getByRole("heading", { name: heading })).toBeDefined();
    }
    expect(within(settings).getByRole("checkbox", { name: "Always show hidden files" })).toBeDefined();

    const settingsProcess = app.environment.os.processes.list().find(
      (process) => process.handlerId === "native:settings",
    );
    expect(settingsProcess?.state).toBe("running");
    expect(settingsProcess?.windowId).toBeDefined();
    expect(app.environment.os.windows.list().some(
      (window) => window.processId === settingsProcess?.id,
    )).toBe(true);

    // Settings.sys is a second generic entry point to the same singleton app,
    // not a different Settings implementation or a launcher document target.
    await app.environment.os.open("/System/Settings.sys");
    const settingsProcesses = app.environment.os.processes.list().filter(
      (process) => process.handlerId === "native:settings",
    );
    expect(settingsProcesses).toHaveLength(1);
    expect(settingsProcesses[0]?.id).toBe(settingsProcess?.id);
    const settingsAfterLauncher = app.getByRole("region", { name: "Settings" });
    for (const heading of capabilityHeadings) {
      expect(within(settingsAfterLauncher).getByRole("heading", { name: heading })).toBeDefined();
    }
    expect(app.queryByRole("region", { name: "Shell settings" })).toBeNull();
  } finally {
    app.dispose();
  }
});
