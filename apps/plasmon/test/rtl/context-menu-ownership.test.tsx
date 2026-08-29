import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("editable FileManager rename controls retain intentional context-menu text behavior", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop was not bootstrapped");
    await app.environment.services.fs.createFile(desktop.id, "Context Menu Gate.txt", { mime: "text/plain" });

    const entry = await app.findByRole("option", { name: "Context Menu Gate.txt" });
    await app.user.click(entry);
    await app.user.keyboard("{F2}");
    const editor = await app.findByRole("textbox", { name: "Rename Context Menu Gate.txt" });

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { editor.dispatchEvent(event); });

    expect(event.defaultPrevented).toBe(false);
    expect(app.queryByRole("menu")).toBeNull();
  } finally {
    app.dispose();
  }
});

test("Shell-owned context is claimed while a foreign child remains unclaimed", async () => {
  const app = await renderPlasmon();
  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    const shellEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { taskbar.dispatchEvent(shellEvent); });
    expect(shellEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(app.getByRole("menu", { name: "Taskbar context menu" })).toBeDefined());

    await app.user.keyboard("{Escape}");
    const workspace = app.container.querySelector("[data-shell-workspace]");
    if (!workspace) throw new Error("Shell workspace was not rendered");
    const foreign = document.createElement("iframe");
    foreign.title = "foreign embedded content";
    workspace.appendChild(foreign);
    const foreignEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { foreign.dispatchEvent(foreignEvent); });
    expect(foreignEvent.defaultPrevented).toBe(false);
    expect(app.queryByRole("menu")).toBeNull();
  } finally {
    app.dispose();
  }
});

test("native app hosts claim first-party content while Browser edit and iframe boundaries remain unclaimed", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      const processId = await app.environment.services.process.open("native:browser", { url: "https://example.com" });
      if (processId === null) throw new Error("Browser native process did not open");
    });

    const browser = await app.findByRole("region", { name: "Web browser" });
    const ownedSurface = browser.closest("[data-plasmon-owned-surface]");
    if (!ownedSurface) throw new Error("Browser was not rendered inside the native first-party ownership boundary");

    const ownedEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { browser.dispatchEvent(ownedEvent); });
    expect(ownedEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(app.getByRole("menu", { name: "Application context menu" })).toBeDefined());
    expect(app.getByRole("menuitem", { name: "No actions available" }).getAttribute("aria-disabled")).toBe("true");

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("menu", { name: "Application context menu" })).toBeNull());

    const address = within(browser).getByRole("textbox", { name: "Web address" });
    const editableEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { address.dispatchEvent(editableEvent); });
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(app.queryByRole("menu", { name: "Application context menu" })).toBeNull();

    await waitFor(() => expect(browser.querySelector("iframe")).not.toBeNull());
    const frame = browser.querySelector("iframe");
    if (!frame) throw new Error("Browser iframe did not render");
    const frameEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { frame.dispatchEvent(frameEvent); });
    expect(frameEvent.defaultPrevented).toBe(false);
    expect(app.queryByRole("menu", { name: "Application context menu" })).toBeNull();
  } finally {
    app.dispose();
  }
});

test("Explorer sidebar uses the native fallback while specialized FileManager context remains authoritative", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      const processId = await app.environment.services.process.open("native:explorer", {});
      if (processId === null) throw new Error("Explorer native process did not open");
    });

    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const favorites = within(explorer).getByRole("complementary", { name: "Favorites" });
    const sidebarEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { favorites.dispatchEvent(sidebarEvent); });
    expect(sidebarEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(app.getByRole("menu", { name: "Application context menu" })).toBeDefined());

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("menu", { name: "Application context menu" })).toBeNull());

    const files = within(explorer).getByRole("listbox", { name: "Files" });
    const fileManagerEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { files.dispatchEvent(fileManagerEvent); });
    expect(fileManagerEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(app.getAllByRole("menu").length).toBeGreaterThan(0));
    expect(app.queryByRole("menu", { name: "Application context menu" })).toBeNull();
  } finally {
    app.dispose();
  }
});
