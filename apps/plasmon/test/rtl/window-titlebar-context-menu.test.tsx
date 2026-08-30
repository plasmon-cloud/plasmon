import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

async function openSettings(app: Awaited<ReturnType<typeof renderPlasmon>>) {
  await act(async () => {
    const processId = await app.environment.services.process.open("native:settings", {});
    if (processId === null) throw new Error("Settings native process did not open");
  });
  return app.findByRole("dialog", { name: "Settings" });
}

async function openWindowContextMenu(window: HTMLElement): Promise<HTMLElement> {
  const titlebar = window.querySelector<HTMLElement>(".plasmon-window__titlebar");
  if (!titlebar) throw new Error("Native window titlebar was not rendered");
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 120,
    clientY: 96,
  });
  await act(async () => { titlebar.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Window context menu"]');
  if (!menu) throw new Error("Window context menu did not open");
  return menu;
}

test("right-clicking a native titlebar opens minimize, maximize, and close actions", async () => {
  const app = await renderPlasmon();
  try {
    const settingsWindow = await openSettings(app);

    let menu = await openWindowContextMenu(settingsWindow);
    await app.user.click(within(menu).getByRole("menuitem", { name: "Maximize" }));
    await waitFor(() => expect(app.environment.windows()[0]?.maximized).toBe(true));
    expect(app.queryByRole("menu", { name: "Window context menu" })).toBeNull();

    menu = await openWindowContextMenu(settingsWindow);
    await app.user.click(within(menu).getByRole("menuitem", { name: "Restore" }));
    await waitFor(() => expect(app.environment.windows()[0]?.maximized).toBe(false));

    menu = await openWindowContextMenu(settingsWindow);
    await app.user.click(within(menu).getByRole("menuitem", { name: "Minimize" }));
    await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(true));
    expect(app.queryByRole("menu", { name: "Window context menu" })).toBeNull();

    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await app.user.click(await within(taskbar).findByRole("button", { name: /^Settings; Running/ }));
    await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(false));

    menu = await openWindowContextMenu(settingsWindow);
    await app.user.click(within(menu).getByRole("menuitem", { name: "Close" }));
    await waitFor(() => {
      expect(app.environment.processes()).toHaveLength(0);
      expect(app.environment.windows()).toHaveLength(0);
    });
  } finally {
    app.dispose();
  }
});

test("native window context menus dismiss on Escape and outside pointer input", async () => {
  const app = await renderPlasmon();
  try {
    const settingsWindow = await openSettings(app);
    await openWindowContextMenu(settingsWindow);
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("menu", { name: "Window context menu" })).toBeNull());

    await openWindowContextMenu(settingsWindow);
    await app.user.click(app.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(app.queryByRole("menu", { name: "Window context menu" })).toBeNull());
  } finally {
    app.dispose();
  }
});
