import { expect, test } from "bun:test";
import { act, within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("taskbar background menu opens TaskManager through canonical native activation", async () => {
  const app = await renderPlasmon();
  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await app.user.pointer({ target: taskbar, keys: "[MouseRight]" });
    const menu = await app.findByRole("menu");
    const item = within(menu).getByRole("menuitem", { name: "Task Manager" });
    expect(item).toBeDefined();
    await act(async () => { await app.user.click(item); });
    expect(app.environment.processes().some((record) => record.handlerId === "native:task-manager")).toBe(true);
  } finally { app.dispose(); }
});
