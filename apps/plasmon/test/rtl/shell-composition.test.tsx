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

test("Shell composes calendar and tray coordination with canonical Settings activation", async () => {
  const app = await renderPlasmon({ elements: [trayElement] });
  const shellPreferences = app.environment.services.shellPreferences;
  await shellPreferences.save({
    ...shellPreferences.getSnapshot(),
    wallpaper: { mode: "follow-theme" },
  });

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
    expect(within(settings).queryByRole("heading", { name: "Backup & sharing" })).toBeNull();
    expect(within(settings).queryByText(/Wave 2|not integrated/i)).toBeNull();

    const navigation = within(settings).getByRole("navigation", { name: "Settings sections" });
    const home = within(navigation).getByRole("button", { name: "Home" });
    const personalization = within(navigation).getByRole("button", { name: "Personalization" });
    const taskbarDestination = within(navigation).getByRole("button", { name: "Taskbar" });
    const files = within(navigation).getByRole("button", { name: "Files & Explorer" });
    const storage = within(navigation).getByRole("button", { name: "Storage" });
    const diagnostics = within(navigation).getByRole("button", { name: "Diagnostics" });

    expect(home.getAttribute("aria-pressed")).toBe("true");
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(within(settings).getByRole("heading", { name: "Settings home" })).toBeDefined();
    expect(within(settings).getByRole("heading", { name: "File associations" })).toBeDefined();

    await app.user.click(files);
    expect(files.getAttribute("aria-pressed")).toBe("true");
    expect(home.getAttribute("aria-pressed")).toBe("false");
    expect(within(settings).getByRole("heading", { name: "Files & Explorer" })).toBeDefined();
    expect(within(settings).getByRole("checkbox", { name: "Always show hidden files" })).toBeDefined();

    await app.user.click(diagnostics);
    expect(diagnostics.getAttribute("aria-pressed")).toBe("true");
    expect(within(settings).getByRole("heading", { name: "Diagnostics" })).toBeDefined();
    expect(within(settings).getByRole("combobox", { name: "System log minimum level" })).toBeDefined();
    expect(within(settings).getByRole("combobox", { name: "Browser console minimum level" })).toBeDefined();

    await app.user.click(home);
    expect(document.activeElement).toBe(home);
    await app.user.tab();
    expect(document.activeElement).toBe(personalization);
    await app.user.keyboard("{Enter}");
    expect(personalization.getAttribute("aria-pressed")).toBe("true");
    expect(personalization.getAttribute("aria-current")).toBe("page");
    expect(within(settings).getByRole("heading", { name: "Personalization" })).toBeDefined();

    const graphite = within(settings).getByRole("button", { name: "Graphite" });
    const verdant = within(settings).getByRole("button", { name: "Verdant" });
    expect(graphite.getAttribute("aria-pressed")).toBe("true");
    expect(verdant.getAttribute("aria-pressed")).toBe("false");
    expect(graphite.classList.contains("plasmon-native-app-button")).toBe(true);
    expect(verdant.classList.contains("plasmon-native-app-button")).toBe(true);

    await app.user.click(verdant);
    await waitFor(() => {
      expect(verdant.getAttribute("aria-pressed")).toBe("true");
      expect(graphite.getAttribute("aria-pressed")).toBe("false");
    });

    const followTheme = within(settings).getByRole("button", { name: "Follow theme" });
    expect(followTheme.hasAttribute("disabled")).toBe(true);
    expect(followTheme.getAttribute("aria-pressed")).toBe("true");
    expect(followTheme.classList.contains("plasmon-native-app-button")).toBe(true);

    await app.user.click(taskbarDestination);
    expect(taskbarDestination.getAttribute("aria-pressed")).toBe("true");
    expect(within(settings).getByRole("heading", { name: "Taskbar" })).toBeDefined();
    const taskbarAlignmentChoices = within(settings).getAllByRole("button", { name: /^(Left|Center)$/ });
    expect(taskbarAlignmentChoices.map((button) => button.textContent)).toEqual(["Left", "Center"]);
    expect(taskbarAlignmentChoices.every((button) => button.classList.contains("plasmon-native-app-button"))).toBe(true);

    await app.user.click(storage);
    expect(storage.getAttribute("aria-pressed")).toBe("true");
    expect(within(settings).getByRole("heading", { name: "Storage" })).toBeDefined();

    const settingsProcess = app.environment.os.processes.list().find(
      (process) => process.handlerId === "native:settings",
    );
    expect(settingsProcess?.state).toBe("running");
    expect(settingsProcess?.windowId).toBeDefined();
    expect(app.environment.os.windows.list().some(
      (window) => window.processId === settingsProcess?.id,
    )).toBe(true);

    await app.environment.os.open("/System/Settings.sys");
    const settingsProcesses = app.environment.os.processes.list().filter(
      (process) => process.handlerId === "native:settings",
    );
    expect(settingsProcesses).toHaveLength(1);
    expect(settingsProcesses[0]?.id).toBe(settingsProcess?.id);
    const settingsAfterLauncher = app.getByRole("region", { name: "Settings" });
    const navigationAfterLauncher = within(settingsAfterLauncher).getByRole("navigation", { name: "Settings sections" });
    const homeAfterLauncher = within(navigationAfterLauncher).getByRole("button", { name: "Home" });
    await waitFor(() => {
      expect(homeAfterLauncher.getAttribute("aria-pressed")).toBe("true");
      expect(within(settingsAfterLauncher).getByRole("heading", { name: "Settings home" })).toBeDefined();
    });
    expect(within(settingsAfterLauncher).queryByRole("heading", { name: "Backup & sharing" })).toBeNull();
    expect(app.queryByRole("region", { name: "Shell settings" })).toBeNull();
  } finally {
    app.dispose();
  }
});