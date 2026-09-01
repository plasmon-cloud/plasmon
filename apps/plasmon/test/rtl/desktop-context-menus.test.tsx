import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import {
  SHELL_PREFERENCES_KEY,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
} from "../../src/os/shell/preferences.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

async function openBackgroundMenu(target: HTMLElement) {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 24,
    clientY: 32,
  });
  await act(async () => { target.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
}

test("Desktop New submenu keeps shared creation actions and nested keyboard focus behavior", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = app.getByRole("region", { name: "Desktop" });
    const files = within(desktop).getByRole("listbox", { name: "Files" });
    await openBackgroundMenu(files);

    const menu = await app.findByRole("menu", { name: "Folder background context menu" });
    const newMenu = within(menu).getByRole("menuitem", { name: "New" });
    expect(within(menu).getByRole("menuitem", { name: "Import Files…" })).toBeDefined();
    expect(within(menu).getByRole("menuitem", { name: "Paste" })).toBeDefined();
    expect(app.queryByRole("menuitem", { name: "New Folder" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(newMenu));

    await app.user.keyboard("{ArrowRight}");
    let submenu = await app.findByRole("menu", { name: "New submenu" });
    const folder = within(submenu).getByRole("menuitem", { name: "New Folder" });
    const text = within(submenu).getByRole("menuitem", { name: "New Text Document" });
    expect(within(submenu).getByRole("menuitem", { name: "New Markdown Document" })).toBeDefined();
    expect(document.activeElement).toBe(folder);

    await app.user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(text);
    await app.user.keyboard("{ArrowLeft}");
    expect(app.queryByRole("menu", { name: "New submenu" })).toBeNull();
    expect(document.activeElement).toBe(newMenu);

    await app.user.keyboard("{ArrowRight}");
    submenu = await app.findByRole("menu", { name: "New submenu" });
    expect(document.activeElement).toBe(within(submenu).getByRole("menuitem", { name: "New Folder" }));
    await app.user.keyboard("{ArrowDown}{Enter}");

    expect(await app.findByRole("textbox", { name: "Rename New Text Document.txt" })).toBeDefined();
    expect(app.queryByRole("menu", { name: "Folder background context menu" })).toBeNull();
  } finally {
    app.dispose();
  }
});

test("Desktop Change Wallpaper submenu uses canonical built-ins and preserves unrelated Shell preferences", async () => {
  const app = await renderPlasmon();
  try {
    const shellPreferences = app.environment.services.shellPreferences;
    const seeded = {
      ...shellPreferences.getSnapshot(),
      pinnedNative: ["native:settings"],
      pinnedElements: ["element:keep-me"],
      themeId: "plasmon-ember" as const,
      wallpaper: { mode: "follow-theme" as const },
      showBrandWatermark: false,
      taskbarAlignment: "left" as const,
    };
    const seededOutcome = await shellPreferences.save(seeded);
    expect(seededOutcome.saved).toBe(true);

    const shell = app.container.querySelector(".plasmon-shell");
    if (!(shell instanceof HTMLElement)) throw new Error("Shell was not rendered");
    await waitFor(() => expect(shell.getAttribute("data-plasmon-wallpaper")).toBe("ember-horizon"));

    const desktop = app.getByRole("region", { name: "Desktop" });
    const files = within(desktop).getByRole("listbox", { name: "Files" });
    await openBackgroundMenu(files);
    const menu = await app.findByRole("menu", { name: "Folder background context menu" });
    const wallpaperMenu = within(menu).getByRole("menuitem", { name: "Change Wallpaper" });
    expect(app.queryByRole("menu", { name: "Change Wallpaper submenu" })).toBeNull();

    await app.user.hover(wallpaperMenu);
    const submenu = await app.findByRole("menu", { name: "Change Wallpaper submenu" });
    expect(within(submenu).getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(
      SHELL_WALLPAPER_IDS.map((id) => SHELL_WALLPAPER_LABELS[id]),
    );
    expect(within(submenu).getByRole("menuitemradio", { name: "Ember Horizon" }).getAttribute("aria-checked")).toBe("true");

    await app.user.click(within(submenu).getByRole("menuitemradio", { name: "Glacier Prism" }));
    await waitFor(() => expect(shell.getAttribute("data-plasmon-wallpaper")).toBe("glacier-prism"));

    const expected = {
      ...seeded,
      wallpaper: { mode: "pinned" as const, id: "glacier-prism" as const },
    };
    await waitFor(() => expect(shellPreferences.getSnapshot()).toEqual(expected));
    await waitFor(async () => {
      const root = await app.environment.services.fs.resolvePath("/");
      expect(root?.metadata[SHELL_PREFERENCES_KEY]).toEqual({
        version: 1,
        pinnedNative: expected.pinnedNative,
        pinnedElements: expected.pinnedElements,
        themeId: expected.themeId,
        appearanceMode: expected.appearanceMode,
        wallpaper: expected.wallpaper,
        wallpaperLayout: expected.wallpaperLayout,
        showBrandWatermark: expected.showBrandWatermark,
        taskbarAlignment: expected.taskbarAlignment,
      });
    });

    await act(async () => {
      const processId = await app.environment.services.process.open("native:explorer", {});
      if (processId === null) throw new Error("Explorer native process did not open");
    });
    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const explorerFiles = within(explorer).getByRole("listbox", { name: "Files" });
    await openBackgroundMenu(explorerFiles);
    const explorerMenu = await app.findByRole("menu", { name: "Folder background context menu" });
    expect(within(explorerMenu).getByRole("menuitem", { name: "New" })).toBeDefined();
    expect(within(explorerMenu).queryByRole("menuitem", { name: "Change Wallpaper" })).toBeNull();
  } finally {
    app.dispose();
  }
});
