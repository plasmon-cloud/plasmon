import { expect, test } from "bun:test";
import { waitFor, within } from "@testing-library/react";
import type { ExternalElement } from "../../src/os/contracts/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const trayElement: ExternalElement = {
  id: "taskbar-status-element",
  name: "Taskbar Status Element",
  description: "Provides one aggregate Neutron tray declaration for taskbar preference coverage.",
  version: 1,
  tiles: [{ id: "main", title: "Status" }],
  tray: { title: "Status tray" },
  running: "yes",
};

test("canonical taskbar preferences apply live while clock and task interaction remain available", async () => {
  const app = await renderPlasmon({ elements: [trayElement] });

  try {
    const shell = app.container.querySelector<HTMLElement>(".plasmon-shell");
    expect(shell).not.toBeNull();
    expect(shell?.dataset.taskbarPlacement).toBe("bottom");
    expect(shell?.dataset.taskIconSize).toBe("medium");
    expect(shell?.dataset.neutronTrayVisible).toBe("true");

    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    expect(taskbar.getAttribute("data-taskbar-alignment")).toBe("center");
    const trayButton = within(taskbar).getByRole("button", { name: "Neutron trays; 1 declared" });
    const clockButton = within(taskbar).getByRole("button", { name: /^Clock and calendar,/ });

    await app.user.click(trayButton);
    expect(await app.findByRole("region", { name: "Neutron trays" })).toBeDefined();

    const outcome = await app.environment.services.shellPreferences.save({
      ...app.environment.services.shellPreferences.getSnapshot(),
      taskbarPlacement: "top",
      taskbarIconSize: "large",
      showNeutronTray: false,
    });
    expect(outcome.saved).toBe(true);

    await waitFor(() => {
      expect(shell?.dataset.taskbarPlacement).toBe("top");
      expect(shell?.dataset.taskIconSize).toBe("large");
      expect(shell?.dataset.neutronTrayVisible).toBe("false");
      expect(app.queryByRole("region", { name: "Neutron trays" })).toBeNull();
    });

    await app.user.click(clockButton);
    expect(await app.findByRole("region", { name: "Clock and calendar" })).toBeDefined();

    await app.user.pointer({ target: taskbar, keys: "[MouseRight]" });
    const menu = await app.findByRole("menu", { name: "Taskbar context menu" });
    await app.user.click(within(menu).getByRole("menuitemradio", { name: "Left-align taskbar icons" }));
    await waitFor(() => expect(taskbar.getAttribute("data-taskbar-alignment")).toBe("left"));

    await app.environment.services.shellPreferences.save({
      ...app.environment.services.shellPreferences.getSnapshot(),
      taskbarPlacement: "bottom",
      taskbarIconSize: "small",
      showNeutronTray: true,
    });
    await waitFor(() => {
      expect(shell?.dataset.taskbarPlacement).toBe("bottom");
      expect(shell?.dataset.taskIconSize).toBe("small");
      expect(shell?.dataset.neutronTrayVisible).toBe("true");
    });

    await app.user.click(trayButton);
    expect(await app.findByRole("region", { name: "Neutron trays" })).toBeDefined();
  } finally {
    app.dispose();
  }
});
