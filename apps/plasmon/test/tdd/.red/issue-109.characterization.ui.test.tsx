import { expect, test } from "bun:test";
import { waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("real Start pin control uses shared stateful icon presentation and accessible labels", async () => {
  const app = await renderPlasmon();
  try {
    await app.user.click(app.getByRole("button", { name: "Start" }));
    const start = app.getByRole("region", { name: "Start menu" });
    const pin = await within(start).findAllByRole("button", { name: "Pin to taskbar" }).then((buttons) => buttons[0]);
    if (!pin) throw new Error("Start pin control missing");
    expect(pin.getAttribute("title")).toBe("Pin to taskbar");
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    expect(pin.querySelector('[data-pin-state="unpinned"]')).not.toBeNull();

    await app.user.click(pin);
    await waitFor(() => expect(within(start).getByRole("button", { name: "Unpin from taskbar" })).toBeDefined());
    const unpin = within(start).getByRole("button", { name: "Unpin from taskbar" });
    expect(unpin.getAttribute("aria-pressed")).toBe("true");
    expect(unpin.querySelector('[data-pin-state="pinned"]')).not.toBeNull();
  } finally { app.dispose(); }
});
