import { expect, test } from "bun:test";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("Shell flyout adapters preserve one-owner open, switch, outside-dismiss, and Escape behavior", async () => {
  const app = await renderPlasmon();
  try {
    const startButton = app.getByRole("button", { name: "Start" });
    const searchButton = app.getByRole("button", { name: "Search" });
    await app.user.click(startButton);
    expect(app.getByRole("region", { name: "Start menu" })).toBeDefined();
    await act(async () => {
      fireEvent.keyDown(window, { key: " ", code: "Space", ctrlKey: true });
    });
    await waitFor(() => expect(app.queryByRole("region", { name: "Start menu" })).toBeNull());
    expect(app.getByRole("region", { name: "Search" })).toBeDefined();
    expect(startButton.getAttribute("aria-expanded")).toBe("false");
    expect(searchButton.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      fireEvent.pointerDown(app.container.ownerDocument.body);
    });
    await waitFor(() => expect(app.queryByRole("region", { name: "Search" })).toBeNull());

    await app.user.click(startButton);
    expect(within(app.getByRole("region", { name: "Start menu" })).getByRole("textbox", { name: "Search Start" })).toBeDefined();
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("region", { name: "Start menu" })).toBeNull());
  } finally { app.dispose(); }
});
