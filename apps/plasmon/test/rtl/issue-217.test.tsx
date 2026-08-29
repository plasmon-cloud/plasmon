import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

const FOLDER_ICON = "static/plasmon/icons/folder.svg";
const FALLBACK_FILE_ICON = "static/plasmon/icons/file.svg";

test("keeps resolved shortcut artwork stable across authoritative Desktop refreshes", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");

    const appsEntry = await app.findByRole("option", { name: "Apps" });
    const renderedIconSource = (): string | null =>
      appsEntry.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? null;

    await waitFor(() => expect(renderedIconSource()).toBe(FOLDER_ICON));

    const observedSources: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.oldValue) observedSources.push(record.oldValue);
      }
      const src = renderedIconSource();
      if (src) observedSources.push(src);
    });
    observer.observe(appsEntry, {
      attributes: true,
      attributeFilter: ["src"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
    });

    await act(async () => {
      await app.environment.services.fs.createFile(desktop.id, "Issue 217 refresh.txt", {
        mime: "text/plain",
      });
    });
    await app.findByRole("option", { name: "Issue 217 refresh.txt" });
    await waitFor(() => expect(renderedIconSource()).toBe(FOLDER_ICON));
    await act(async () => { await Promise.resolve(); });
    observer.disconnect();

    expect(observedSources).not.toContain(FALLBACK_FILE_ICON);
  } finally {
    app.dispose();
  }
});
