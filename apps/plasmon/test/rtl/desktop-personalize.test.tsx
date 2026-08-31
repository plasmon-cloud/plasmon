import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Desktop background Personalize opens and retargets the singleton canonical Settings app", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.findByRole("region", { name: "Desktop" });
    const desktopFiles = within(desktop).getByRole("listbox", { name: "Files" });

    await app.user.pointer({ target: desktopFiles, keys: "[MouseRight]" });
    let menu = await app.findByRole("menu");
    const personalize = within(menu).getByRole("menuitem", { name: "Personalize" });
    expect(personalize).toBeDefined();
    await app.user.click(personalize);

    const settings = await app.findByRole("region", { name: "Settings" });
    expect(within(settings).getByRole("heading", { name: "Personalization" })).toBeDefined();
    const settingsProcesses = () => app.environment.os.processes.list().filter(
      (process) => process.handlerId === "native:settings",
    );
    expect(settingsProcesses()).toHaveLength(1);
    const firstProcessId = settingsProcesses()[0]?.id;
    const firstWindowId = settingsProcesses()[0]?.windowId;
    expect(settingsProcesses()[0]?.target.appDestination).toBe("personalization");

    const navigation = within(settings).getByRole("navigation", { name: "Settings sections" });
    await app.user.click(within(navigation).getByRole("button", { name: "Diagnostics" }));
    expect(settingsProcesses()[0]?.target.appDestination).toBe("diagnostics");
    expect(within(settings).getByRole("heading", { name: "Diagnostics" })).toBeDefined();

    await app.user.pointer({ target: desktopFiles, keys: "[MouseRight]" });
    menu = await app.findByRole("menu");
    await app.user.click(within(menu).getByRole("menuitem", { name: "Personalize" }));

    await waitFor(() => {
      expect(settingsProcesses()).toHaveLength(1);
      expect(settingsProcesses()[0]?.id).toBe(firstProcessId);
      expect(settingsProcesses()[0]?.windowId).toBe(firstWindowId);
      expect(settingsProcesses()[0]?.target.appDestination).toBe("personalization");
      expect(within(settings).getByRole("heading", { name: "Personalization" })).toBeDefined();
    });

    const desktopDirectory = await app.environment.node("/Desktop");
    if (!desktopDirectory || desktopDirectory.kind !== "directory") throw new Error("Desktop was not bootstrapped");
    await act(async () => {
      await app.environment.services.fs.createFile(desktopDirectory.id, "No Item Personalize.txt", { mime: "text/plain" });
    });
    const desktopItem = await within(desktop).findByRole("option", { name: "No Item Personalize.txt" });
    await app.user.pointer({ target: desktopItem, keys: "[MouseRight]" });
    menu = await app.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Personalize" })).toBeNull();
    await app.user.keyboard("{Escape}");

    await act(async () => {
      const processId = await app.environment.services.process.open("native:explorer", {});
      if (processId === null) throw new Error("Explorer native process did not open");
    });
    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const explorerFiles = within(explorer).getByRole("listbox", { name: "Files" });
    await app.user.pointer({ target: explorerFiles, keys: "[MouseRight]" });
    menu = await app.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Personalize" })).toBeNull();
  } finally {
    app.dispose();
  }
});
