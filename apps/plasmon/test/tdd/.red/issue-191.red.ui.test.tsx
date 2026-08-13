import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../../../test/renderPlasmon.tsx";

/**
 * The sibling shared RTL guard already covers click, Enter commit, context
 * commands and activation. This issue-scoped adapter characterization adds
 * only the React Escape-cancellation wiring, which is not covered by the
 * deterministic rename model.
 */
test("#191 characterization wires Escape cancellation without mutating the NodeId resource", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");
    const created = await act(async () => app.environment.services.fs.createFile(desktop.id, "Issue 191 Escape.txt", {
      mime: "text/plain",
    }));

    const entry = await app.findByRole("option", { name: "Issue 191 Escape.txt" });
    await app.user.click(entry);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);

    await app.user.keyboard("{F2}");
    await app.findByRole("textbox", { name: "Rename Issue 191 Escape.txt" });
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(app.queryByRole("textbox", { name: "Rename Issue 191 Escape.txt" })).toBeNull());

    const current = await app.environment.services.fs.stat(created.id);
    expect(current.id).toBe(created.id);
    expect(current.name).toBe("Issue 191 Escape.txt");
  } finally {
    app.dispose();
  }
});
