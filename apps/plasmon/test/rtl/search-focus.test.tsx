import { expect, test } from "bun:test";
import { waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Start-to-Search and direct Search activation focus the intended textbox", async () => {
  const app = await renderPlasmon();

  try {
    await app.user.click(app.getByRole("button", { name: "Start" }));
    const start = await app.findByRole("region", { name: "Start menu" });
    const startInput = within(start).getByRole("textbox", { name: "Search Start" });
    await waitFor(() => expect(document.activeElement).toBe(startInput));

    await app.user.type(startInput, "notes");
    await app.user.keyboard("{Enter}");
    const searchFromStart = await app.findByRole("region", { name: "Search" });
    const searchFromStartInput = within(searchFromStart).getByRole("textbox", { name: "Search Plasmon" });
    await waitFor(() => expect(document.activeElement).toBe(searchFromStartInput));
    expect((searchFromStartInput as HTMLInputElement).value).toBe("notes");

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("region", { name: "Search" })).toBeNull());

    await app.user.click(app.getByRole("button", { name: "Search" }));
    const directSearch = await app.findByRole("region", { name: "Search" });
    const directSearchInput = within(directSearch).getByRole("textbox", { name: "Search Plasmon" });
    await waitFor(() => expect(document.activeElement).toBe(directSearchInput));
  } finally {
    app.dispose();
  }
});
