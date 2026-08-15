import { expect, test } from "bun:test";
import { act } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

/**
 * Issue #112 is presentation convergence, not a new application framework.
 * Exercise the real native-app/process composition and require representative
 * editor, media, and utility/system surfaces to consume the shared Visual
 * content-chrome vocabulary while retaining their own semantic controls.
 *
 * Keep the editor case on its deterministic empty-state path: mounting Monaco
 * crosses a browser-engine boundary that Happy DOM intentionally does not fake.
 */
test("#112 representative native apps consume shared content chrome", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.services.process.open("native:text", {});
    });
    const editorSurface = await app.findByRole("region", { name: "Text editor" });
    expect(editorSurface.classList.contains("plasmon-native-app-surface")).toBe(true);
    const editorEmpty = await app.findByText("Choose a text file to open.");
    expect(editorEmpty.classList.contains("plasmon-native-app-state")).toBe(true);

    await act(async () => {
      await app.environment.services.process.open("native:photos", {});
    });
    const mediaToolbar = await app.findByRole("navigation", { name: "Photo controls" });
    expect(mediaToolbar.classList.contains("plasmon-native-app-toolbar")).toBe(true);
    const zoomOut = app.getByRole("button", { name: "Zoom out" });
    expect(zoomOut.classList.contains("plasmon-native-app-button")).toBe(true);
    const mediaEmpty = await app.findByText("Choose an image to open.");
    expect(mediaEmpty.classList.contains("plasmon-native-app-state")).toBe(true);
    const mediaStatus = app.getByText(/next image/).closest("footer");
    expect(mediaStatus?.classList.contains("plasmon-native-app-status")).toBe(true);

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
