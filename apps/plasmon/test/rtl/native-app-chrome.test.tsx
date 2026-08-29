import { expect, test } from "bun:test";
import { act } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

/**
 * Presentation convergence is not a new application framework.
 * Exercise the real native-app/process composition and require representative
 * editor, media, and utility/system surfaces to consume the shared Visual
 * content-chrome vocabulary while retaining their own semantic controls.
 *
 * Keep browser-engine adapters outside this deterministic lane: Text remains on
 * its no-document path rather than mounting Monaco, and Video remains on its
 * no-target error path rather than mounting a media element. Those engines keep
 * their existing browser/package coverage.
 */
test("representative native apps consume shared content chrome", async () => {
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
      await app.environment.services.process.open("native:video", {});
    });
    const mediaSurface = await app.findByRole("region", { name: "Video player" });
    expect(mediaSurface.classList.contains("plasmon-native-app-surface")).toBe(true);
    const mediaError = await app.findByRole("alert");
    expect(mediaError.textContent).toContain("No video target was supplied");
    expect(mediaError.classList.contains("plasmon-native-app-state")).toBe(true);
    expect(mediaError.classList.contains("plasmon-native-app-state--error")).toBe(true);
    const mediaStatus = app.getByText(/play-pause/).closest("footer");
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
