import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

/**
 * The sibling shared RTL guard covers click, Enter commit, context commands,
 * and activation. This adapter characterization adds Escape-cancellation wiring.
 */
test("characterization wires Escape cancellation without mutating the NodeId resource", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");
    const created = await act(async () => app.environment.services.fs.createFile(desktop.id, "Escape Rename Fixture.txt", {
      mime: "text/plain",
    }));

    const entry = await app.findByRole("option", { name: "Escape Rename Fixture.txt" });
    await app.user.click(entry);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);

    await app.user.keyboard("{F2}");
    await app.findByRole("textbox", { name: "Rename Escape Rename Fixture.txt" });
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("textbox", { name: "Rename Escape Rename Fixture.txt" })).toBeNull());

    const current = await app.environment.services.fs.stat(created.id);
    expect(current.id).toBe(created.id);
    expect(current.name).toBe("Escape Rename Fixture.txt");
  } finally {
    app.dispose();
  }
});