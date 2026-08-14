import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("#196 Grid, List and Details render one shared NodeId selection through explicit view strategies", async () => {
  const app = await renderPlasmon();
  try {
    const documents = await app.environment.node("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents did not bootstrap");

    const created = await act(async () => app.environment.services.fs.createFile(
      documents.id,
      "Issue 196 Strategy Seam.txt",
      { mime: "text/plain" },
    ));

    await act(async () => app.environment.open("/Documents"));
    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const explorerView = within(explorer);
    const viewSelect = explorerView.getByLabelText("View");

    let entry = await explorerView.findByRole("option", { name: "Issue 196 Strategy Seam.txt" });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    await app.user.click(entry);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(explorerView.queryByText("text/plain")).toBeNull();

    await app.user.selectOptions(viewSelect, "list");
    entry = await explorerView.findByRole("option", { name: "Issue 196 Strategy Seam.txt" });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(explorerView.queryByText("text/plain")).toBeNull();

    await app.user.selectOptions(viewSelect, "details");
    entry = await explorerView.findByRole("option", { name: "Issue 196 Strategy Seam.txt" });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(explorerView.getByText("text/plain")).toBeDefined());
  } finally {
    app.dispose();
  }
});
