import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#946"/></svg>';

async function openPersonalization(app: Awaited<ReturnType<typeof renderPlasmon>>) {
  await act(async () => {
    await app.environment.os.open("/System/Settings.sys");
  });
  await app.user.click(await app.findByRole("button", { name: "Personalization" }));
  const heading = await app.findByRole("heading", { name: "Personalization" });
  const section = heading.closest("section");
  if (!section) throw new Error("Personalization section is unavailable");
  return within(section);
}

test("Personalization exposes real thumbnails, Follow theme, filesystem choice, and independent layouts", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.os.fs.createDirectory("/Pictures");
      await app.environment.os.fs.writeText("/Pictures/My Wallpaper.svg", SVG);
    });
    const controls = await openPersonalization(app);
    const shell = app.container.querySelector<HTMLElement>(".plasmon-shell");
    if (!shell) throw new Error("Shell root is unavailable");

    const graphite = controls.getByRole("button", { name: "Graphite" });
    const verdant = controls.getByRole("button", { name: "Verdant" });
    const dark = controls.getByRole("button", { name: "Dark" });
    const followTheme = controls.getByRole("button", { name: "Follow theme" });
    const rosewoodBloom = controls.getByRole("button", { name: "Rosewood Bloom" });
    const emberHorizon = controls.getByRole("button", { name: "Ember Horizon" });

    expect(graphite.getAttribute("aria-pressed")).toBe("true");
    expect(dark.getAttribute("aria-pressed")).toBe("true");
    expect(rosewoodBloom.getAttribute("aria-pressed")).toBe("true");
    expect(followTheme.getAttribute("aria-pressed")).toBe("false");

    for (const name of [
      "Graphite Sand",
      "Plasmon Lattice",
      "Midnight Orbit",
      "Ember Horizon",
      "Glacier Prism",
      "Rosewood Bloom",
    ]) {
      const button = controls.getByRole("button", { name });
      const thumbnail = button.querySelector("img");
      expect(thumbnail).not.toBeNull();
      expect(thumbnail?.getAttribute("src")).toContain("/wallpapers/");
    }

    await app.user.click(followTheme);
    await waitFor(() => {
      expect(followTheme.getAttribute("aria-pressed")).toBe("true");
      expect(shell.dataset.plasmonWallpaper).toBe("graphite-sand");
    });
    let snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-graphite");
    expect(snapshot.appearanceMode).toBe("dark");
    expect(snapshot.wallpaper).toEqual({ mode: "follow-theme" });

    await app.user.click(verdant);
    await waitFor(() => expect(shell.dataset.plasmonWallpaper).toBe("plasmon-lattice"));
    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-verdant");
    expect(snapshot.appearanceMode).toBe("dark");
    expect(snapshot.wallpaper).toEqual({ mode: "follow-theme" });

    await app.user.click(emberHorizon);
    await waitFor(() => expect(emberHorizon.getAttribute("aria-pressed")).toBe("true"));
    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-verdant");
    expect(snapshot.appearanceMode).toBe("dark");
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "ember-horizon" });

    const layoutGroup = controls.getByRole("group", { name: "Wallpaper layout" });
    const layoutControls = within(layoutGroup);
    const fill = layoutControls.getByRole("button", { name: "Fill" });
    const fit = layoutControls.getByRole("button", { name: "Fit" });
    expect(fill.getAttribute("aria-pressed")).toBe("true");
    await app.user.click(fit);
    await waitFor(() => expect(fit.getAttribute("aria-pressed")).toBe("true"));
    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.wallpaperLayout).toBe("fit");
    expect(snapshot.themeId).toBe("plasmon-verdant");
    expect(snapshot.appearanceMode).toBe("dark");
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "ember-horizon" });

    await app.user.click(controls.getByRole("button", { name: "Choose filesystem image…" }));
    const chooser = controls.getByLabelText("Filesystem wallpaper chooser");
    const fileButton = within(chooser).getByRole("button", { name: "My Wallpaper.svg" });
    expect(fileButton.getAttribute("aria-pressed")).toBe("false");
    await app.user.click(fileButton);

    await waitFor(() => {
      const current = app.environment.services.shellPreferences.getSnapshot();
      expect(current.wallpaper.mode).toBe("filesystem");
      expect(shell.dataset.plasmonWallpaperTarget).toBe(
        current.wallpaper.mode === "filesystem" ? current.wallpaper.nodeId : "",
      );
    });
    snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.themeId).toBe("plasmon-verdant");
    expect(snapshot.appearanceMode).toBe("dark");
    expect(snapshot.wallpaperLayout).toBe("fit");
    expect(snapshot.wallpaper.mode).toBe("filesystem");
    expect(await app.findByText("Selected: My Wallpaper.svg")).not.toBeNull();
  } finally {
    app.dispose();
  }
});
