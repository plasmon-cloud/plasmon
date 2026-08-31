import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Settings changes Light/Dark independently from theme and wallpaper", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.os.open("/System/Settings.sys");
    });

    const appearanceHeading = await app.findByRole("heading", { name: "Appearance" });
    const appearancePanel = appearanceHeading.closest("section");
    if (!appearancePanel) throw new Error("Appearance panel is unavailable");
    const controls = within(appearancePanel);

    const graphite = controls.getByRole("button", { name: "Graphite" });
    const midnight = controls.getByRole("button", { name: "Midnight" });
    const dark = controls.getByRole("button", { name: "Dark" });
    const light = controls.getByRole("button", { name: "Light" });
    const followTheme = controls.getByRole("button", { name: "Follow theme" });
    const rosewoodBloom = controls.getByRole("button", { name: "Rosewood Bloom" });
    const shell = app.container.querySelector<HTMLElement>(".plasmon-shell");
    if (!shell) throw new Error("Shell root is unavailable");

    expect(graphite.getAttribute("aria-pressed")).toBe("true");
    expect(dark.getAttribute("aria-pressed")).toBe("true");
    expect(light.getAttribute("aria-pressed")).toBe("false");
    expect(followTheme.getAttribute("aria-pressed")).toBe("false");
    expect(rosewoodBloom.getAttribute("aria-pressed")).toBe("true");
    expect(shell.dataset.plasmonTheme).toBe("plasmon-graphite");
    expect(shell.dataset.plasmonAppearance).toBe("dark");
    expect(shell.dataset.plasmonWallpaper).toBe("rosewood-bloom");

    await app.user.click(light);
    await waitFor(() => {
      expect(light.getAttribute("aria-pressed")).toBe("true");
      expect(dark.getAttribute("aria-pressed")).toBe("false");
      expect(shell.dataset.plasmonAppearance).toBe("light");
    });

    let snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-graphite");
    expect(snapshot.appearanceMode).toBe("light");
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
    expect(shell.dataset.plasmonWallpaper).toBe("rosewood-bloom");

    await app.user.click(midnight);
    await waitFor(() => {
      expect(midnight.getAttribute("aria-pressed")).toBe("true");
      expect(graphite.getAttribute("aria-pressed")).toBe("false");
      expect(shell.dataset.plasmonTheme).toBe("plasmon-midnight");
    });

    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.appearanceMode).toBe("light");
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
    expect(rosewoodBloom.getAttribute("aria-pressed")).toBe("true");
    expect(shell.dataset.plasmonWallpaper).toBe("rosewood-bloom");

    await app.user.click(dark);
    await waitFor(() => expect(shell.dataset.plasmonAppearance).toBe("dark"));
    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-midnight");
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
  } finally {
    app.dispose();
  }
});
