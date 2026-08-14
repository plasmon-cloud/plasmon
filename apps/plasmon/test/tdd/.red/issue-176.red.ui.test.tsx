import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("#176 editable FileManager rename controls retain intentional context-menu text behavior", async () => {
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

    // This is the intentional RED: the editable control is an intentional
    // browser/editor boundary and must not be claimed by FileManager's outer
    // specialized menu policy.
    expect(event.defaultPrevented).toBe(false);
    expect(app.queryByRole("menu")).toBeNull();
  } finally {
    app.dispose();
  }
});

test("#176 Shell-owned context is claimed while a foreign child remains unclaimed", async () => {
  const app = await renderPlasmon();
  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    const shellEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    await act(async () => { taskbar.dispatchEvent(shellEvent); });
    expect(shellEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(app.getByRole("menu", { name: "Shell context menu" })).toBeDefined());

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
