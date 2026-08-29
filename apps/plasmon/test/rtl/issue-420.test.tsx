import { expect, test } from "bun:test";
import { act, waitFor } from "@testing-library/react";
import { readSharedShortcut } from "../../src/os/fs/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const FOLDER_ICON_ID = "file-type:folder";
const FALLBACK_FILE_ICON_ID = "file-type:file";

test("#420 keeps last resolved shortcut artwork through transient target lookup failure", async () => {
  const app = await renderPlasmon();
  const fs = app.environment.services.fs;
  const originalStat = fs.stat;
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");
    const rootShortcut = await app.environment.node("/Desktop/Root");
    if (!rootShortcut) throw new Error("Desktop Root shortcut did not bootstrap");
    const shortcut = readSharedShortcut(rootShortcut);
    if (!shortcut || shortcut.target.kind !== "node") {
      throw new Error("Desktop Root entry is not a node-target shortcut");
    }

    const rootEntry = await app.findByRole("option", { name: "Root" });
    const renderedIconIdentity = (): string | null =>
      rootEntry.querySelector<SVGElement>("[data-plasmon-owned-icon]")?.getAttribute("data-plasmon-owned-icon") ?? null;
    await waitFor(() => expect(renderedIconIdentity()).toBe(FOLDER_ICON_ID));

    const observedIdentities: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.oldValue) observedIdentities.push(record.oldValue);
      }
      const identity = renderedIconIdentity();
      if (identity) observedIdentities.push(identity);
    });
    observer.observe(rootEntry, {
      attributes: true,
      attributeFilter: ["data-plasmon-owned-icon"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
    });

    let injectedFailurePending = true;
    fs.stat = async (id) => {
      if (injectedFailurePending && id === shortcut.target.nodeId) {
        injectedFailurePending = false;
        throw new Error("Issue 420 transient shortcut target lookup failure");
      }
      return originalStat.call(fs, id);
    };

    await act(async () => {
      await fs.createFile(desktop.id, "Issue 420 refresh.txt", { mime: "text/plain" });
    });
    await app.findByRole("option", { name: "Issue 420 refresh.txt" });
    await waitFor(() => expect(injectedFailurePending).toBe(false));
    await waitFor(() => expect(renderedIconIdentity()).toBe(FOLDER_ICON_ID));

    // Restore target lookup and force one more authoritative Desktop snapshot so
    // the same mounted NodeId proves it can recover normally after the failed
    // enrichment without ever publishing the generic file artwork in between.
    fs.stat = originalStat;
    await act(async () => {
      await fs.createFile(desktop.id, "Issue 420 recovery.txt", { mime: "text/plain" });
    });
    await app.findByRole("option", { name: "Issue 420 recovery.txt" });
    await waitFor(() => expect(renderedIconIdentity()).toBe(FOLDER_ICON_ID));
    await act(async () => { await Promise.resolve(); });
    observer.disconnect();

    expect(observedIdentities).not.toContain(FALLBACK_FILE_ICON_ID);
  } finally {
    fs.stat = originalStat;
    app.dispose();
  }
});
