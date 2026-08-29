import { expect, test } from "bun:test";
import { act, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

const strategySeamName = /^Strategy Seam Fixture\.txt/;

test("Grid, List and Details render one shared NodeId selection through explicit view strategies", async () => {
  const app = await renderPlasmon();
  try {
    const documents = await app.environment.node("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents did not bootstrap");

    const created = await act(async () => app.environment.services.fs.createFile(
      documents.id,
      "Strategy Seam Fixture.txt",
      { mime: "text/plain" },
    ));

    await act(async () => app.environment.open("/Documents"));

    let explorer = await app.findByRole("region", { name: "File Explorer" });
    let explorerView = within(explorer);
    let entry = await explorerView.findByRole("option", { name: strategySeamName });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    await app.user.click(entry);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(explorerView.queryByText("text/plain")).toBeNull();

    await app.user.selectOptions(explorerView.getByLabelText("View"), "list");
    explorer = await app.findByRole("region", { name: "File Explorer" });
    explorerView = within(explorer);
    entry = await explorerView.findByRole("option", { name: strategySeamName });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(explorerView.queryByText("text/plain")).toBeNull();

    await app.user.selectOptions(explorerView.getByLabelText("View"), "details");
    explorer = await app.findByRole("region", { name: "File Explorer" });
    explorerView = within(explorer);
    entry = await explorerView.findByRole("option", { name: strategySeamName });
    expect(entry.getAttribute("data-fm-node-id")).toBe(created.id);
    expect(entry.getAttribute("aria-selected")).toBe("true");
    expect(within(entry).getByText("text/plain")).toBeDefined();
  } finally {
    app.dispose();
  }
});
