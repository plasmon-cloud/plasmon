import { expect, test } from "bun:test";
import { within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("taskbar background context menu exposes Show desktop", async () => {
  const app = await renderPlasmon();
  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await app.user.pointer({ target: taskbar, keys: "[MouseRight]" });
    const menu = await app.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Show desktop/i })).toBeDefined();
  } finally {
    app.dispose();
  }
});
