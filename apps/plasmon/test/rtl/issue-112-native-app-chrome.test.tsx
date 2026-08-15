import { expect, test } from "bun:test";
import { act } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

/**
 * Issue #112 is presentation convergence, not a new application framework.
 * Exercise the real native-app/process composition and require representative
 * editor, media, and utility/system surfaces to consume the shared Visual
 * content-chrome vocabulary while retaining their own semantic controls.
 */
test("#112 representative native apps consume shared content chrome", async () => {
  const app = await renderPlasmon();
  try {
    const desktop = await app.environment.node("/Desktop");
    if (!desktop || desktop.kind !== "directory") throw new Error("Desktop did not bootstrap");

    const document = await act(async () => app.environment.services.fs.createFile(
      desktop.id,
      "Issue 112 Editor.txt",
      { mime: "text/plain" },
    ));
    await act(async () => {
      await app.environment.services.process.open("native:text", { nodeId: document.id });
    });

    const editorToolbar = await app.findByRole("toolbar", { name: "Text file controls" });
    expect(editorToolbar.classList.contains("plasmon-native-app-toolbar")).toBe(true);
    const editorStatus = app.getByText("UTF-8").closest("footer");
    expect(editorStatus?.classList.contains("plasmon-native-app-status")).toBe(true);

    await act(async () => {
      await app.environment.services.process.open("native:photos", {});
    });
    const mediaToolbar = await app.findByRole("navigation", { name: "Photo controls" });
    expect(mediaToolbar.classList.contains("plasmon-native-app-toolbar")).toBe(true);
    const mediaEmpty = await app.findByText("Choose an image to open.");
    expect(mediaEmpty.classList.contains("plasmon-native-app-state")).toBe(true);

    await act(async () => {
      await app.environment.services.process.open("native:settings", {});
    });
    const settingsSurface = await app.findByRole("region", { name: "Settings" });
    expect(settingsSurface.classList.contains("plasmon-native-app-surface")).toBe(true);
    const storageHeading = await app.findByRole("heading", { name: "Storage" });
    expect(storageHeading.closest("section")?.classList.contains("plasmon-native-app-panel")).toBe(true);
  } finally {
    app.dispose();
  }
});
