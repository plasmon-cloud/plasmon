import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import type { ExternalElement } from "../../src/os/contracts/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const reviewElement: ExternalElement = {
  id: "review",
  name: "Review",
  description: "Collaborative review workspace.",
  version: 1,
  icon: "/app/review/icon.svg",
  tiles: [{ id: "review", title: "Review" }],
  running: "no",
};

test("assembled React shell projects production authorities without owning parallel state", async () => {
  const app = await renderPlasmon({ elements: [reviewElement] });

  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    expect(app.getByRole("button", { name: "Start" })).toBeDefined();
    expect(app.getByRole("button", { name: "Search" })).toBeDefined();
    expect(taskbar).toBeDefined();

    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");
    await act(async () => {
      await app.environment.services.fs.createFile(desktop.id, "Refactor Surface.txt", {
        mime: "text/plain",
      });
    });
    expect(await app.findByRole("option", { name: "Refactor Surface.txt" })).toBeDefined();

    await app.user.click(app.getByRole("button", { name: "Search" }));
    const search = app.getByRole("region", { name: "Search" });
    await app.user.type(within(search).getByRole("textbox", { name: "Search Plasmon" }), "Settings");

    const settingsLabel = await within(search).findByText("Settings", { selector: "strong" });
    const settingsResult = settingsLabel.closest("button");
    if (!settingsResult) throw new Error("Settings search result is not activatable");
    await app.user.click(settingsResult);

    await waitFor(() => expect(app.environment.processes()).toHaveLength(1));
    expect(app.environment.processes()[0]?.handlerId).toBe("native:settings");
    expect(app.environment.windows()).toHaveLength(1);

    const activeTask = await within(taskbar).findByRole("button", {
      name: /^Settings; Active and focused/,
    });
    await app.user.click(activeTask);
    await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(true));

    const runningTask = await within(taskbar).findByRole("button", { name: /^Settings; Running/ });
    await app.user.click(runningTask);
    await waitFor(() => expect(app.environment.windows()[0]?.minimized).toBe(false));

    const settingsWindow = await app.findByRole("dialog", { name: "Settings" });
    await app.user.click(within(settingsWindow).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(app.environment.processes()).toHaveLength(0);
      expect(app.environment.windows()).toHaveLength(0);
    });
    expect(within(taskbar).queryByRole("button", { name: /^Settings;/ })).toBeNull();
  } finally {
    app.dispose();
  }
});
