import { expect, test } from "bun:test";
import { waitFor, within } from "@testing-library/react";
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

test("Shell composes calendar, tray, settings, and global one-flyout coordination", async () => {
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

    const settings = await app.findByRole("region", { name: "Shell settings" });
    expect(app.queryByRole("region", { name: "Clock and calendar" })).toBeNull();
    expect(within(settings).getByRole("heading", { name: "Theme" })).toBeDefined();

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("region", { name: "Shell settings" })).toBeNull());
  } finally {
    app.dispose();
  }
});
