import { expect, test } from "bun:test";
import { within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("taskbar background menu exposes Center and Left alignment choices", async () => {
  const app = await renderPlasmon();
  try {
    const taskbar = app.getByRole("navigation", { name: "Taskbar" });
    await app.user.pointer({ target: taskbar, keys: "[MouseRight]" });
    const menu = await app.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Center taskbar icons" })).toBeDefined();
    expect(within(menu).getByRole("menuitem", { name: "Left-align taskbar icons" })).toBeDefined();
  } finally { app.dispose(); }
});
