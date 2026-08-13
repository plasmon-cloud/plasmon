import { expect, test } from "bun:test";
import { act, within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("running taskbar context menu exposes canonical Close action", async () => {
  const app = await renderPlasmon();
  try {
    let processId: string | null = null;
    await act(async () => {
      processId = await app.environment.services.process.open("native:explorer", {});
    });
    expect(processId).not.toBeNull();
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    const task = await within(taskbar).findByRole("button", { name: /^Files; Active and focused/ });

    await app.user.pointer({ target: task, keys: "[MouseRight]" });
    const menu = await app.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Close" })).toBeDefined();
  } finally {
    app.dispose();
  }
});
