import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

const FOLDER_ICON_ID = "file-type:folder";
const FALLBACK_FILE_ICON_ID = "file-type:file";

test("keeps resolved shortcut artwork stable across authoritative Desktop refreshes", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");

    const appsEntry = await app.findByRole("option", { name: "Apps" });
    const renderedIconIdentity = (): string | null =>
      appsEntry.querySelector<SVGElement>("[data-plasmon-owned-icon]")?.getAttribute("data-plasmon-owned-icon") ?? null;

    await waitFor(() => expect(renderedIconIdentity()).toBe(FOLDER_ICON_ID));

    const observedIdentities: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.oldValue) observedIdentities.push(record.oldValue);
      }
      const identity = renderedIconIdentity();
      if (identity) observedIdentities.push(identity);
    });
    observer.observe(appsEntry, {
      attributes: true,
      attributeFilter: ["data-plasmon-owned-icon"],
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
    await waitFor(() => expect(renderedIconIdentity()).toBe(FOLDER_ICON_ID));
    await act(async () => { await Promise.resolve(); });
    observer.disconnect();

    expect(observedIdentities).not.toContain(FALLBACK_FILE_ICON_ID);
  } finally {
    app.dispose();
  }
});
