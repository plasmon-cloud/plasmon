import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Settings changes Light/Dark independently from theme and wallpaper", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.os.open("/System/Settings.sys");
    });

    await app.user.click(await app.findByRole("button", { name: "Personalization" }));
    const appearanceHeading = await app.findByRole("heading", { name: "Personalization" });
    const appearancePanel = appearanceHeading.closest("section");
    if (!appearancePanel) throw new Error("Personalization panel is unavailable");
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

test("Settings derives Custom from system colors while icons remain an independent accessible axis", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.os.open("/System/Settings.sys");
    });

    await app.user.click(await app.findByRole("button", { name: "Personalization" }));
    const heading = await app.findByRole("heading", { name: "Personalization" });
    const panel = heading.closest("section");
    if (!panel) throw new Error("Personalization panel is unavailable");
    const controls = within(panel);

    expect(controls.getByRole("status").textContent).toContain("System colors: Graphite");
    expect(controls.getByRole("button", { name: "Graphite" }).getAttribute("aria-pressed")).toBe("true");
    const iconSet = controls.getByRole("combobox", { name: "Icon set" }) as HTMLSelectElement;
    expect(iconSet.disabled).toBe(true);
    expect(iconSet.value).toBe("plasmon");

    const followIconColors = controls.getByRole("button", { name: "Follow theme icon colors" });
    const customIcons = controls.getByRole("button", { name: "Custom icons" });
    expect(followIconColors.getAttribute("aria-pressed")).toBe("true");
    expect(customIcons.getAttribute("aria-pressed")).toBe("false");

    const accentHex = controls.getByRole("textbox", { name: "Accent / selection / focus hex value" });
    await app.user.clear(accentHex);
    await app.user.type(accentHex, "#123456{Enter}");

    await waitFor(() => {
      const snapshot = app.environment.services.shellPreferences.getSnapshot();
      expect(snapshot.systemColorOverrides).toEqual({ accent: "#123456" });
      expect(controls.getByRole("status").textContent).toContain("System colors: Custom");
      expect(document.documentElement.style.getPropertyValue("--plasmon-accent")).toBe("#123456");
    });

    let snapshot = app.environment.services.shellPreferences.getSnapshot();
    expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
    expect(snapshot.iconPalette).toEqual({ mode: "follow-theme" });

    await app.user.click(customIcons);
    await waitFor(() => {
      expect(app.environment.services.shellPreferences.getSnapshot().iconPalette.mode).toBe("custom");
      expect(customIcons.getAttribute("aria-pressed")).toBe("true");
    });

    await app.user.click(controls.getByRole("button", { name: "Reset colors to Graphite" }));
    await waitFor(() => {
      snapshot = app.environment.services.shellPreferences.getSnapshot();
      expect(snapshot.systemColorOverrides).toEqual({});
      expect(snapshot.iconPalette.mode).toBe("custom");
      expect(controls.getByRole("status").textContent).toContain("System colors: Graphite");
      expect(document.documentElement.style.getPropertyValue("--plasmon-accent")).toBe("");
    });

    const primaryIconHex = controls.getByRole("textbox", { name: "Primary icon color hex value" });
    await app.user.clear(primaryIconHex);
    await app.user.type(primaryIconHex, "#abcdef{Enter}");
    await waitFor(() => {
      snapshot = app.environment.services.shellPreferences.getSnapshot();
      if (snapshot.iconPalette.mode !== "custom") throw new Error("Custom icon palette was not retained");
      expect(snapshot.iconPalette.colors.primary).toBe("#abcdef");
      expect(snapshot.systemColorOverrides).toEqual({});
      expect(controls.getByRole("status").textContent).toContain("System colors: Graphite");
      expect(document.documentElement.style.getPropertyValue("--plasmon-icon-primary")).toBe("#abcdef");
    });

    await app.user.click(controls.getByRole("button", { name: "Midnight" }));
    await waitFor(() => {
      snapshot = app.environment.services.shellPreferences.getSnapshot();
      expect(snapshot.themeId).toBe("plasmon-midnight");
      if (snapshot.iconPalette.mode !== "custom") throw new Error("Custom icon palette was not retained");
      expect(snapshot.iconPalette.colors.primary).toBe("#abcdef");
      expect(snapshot.systemColorOverrides).toEqual({});
      expect(snapshot.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
      expect(controls.getByRole("status").textContent).toContain("System colors: Midnight");
    });

    await app.user.click(controls.getByRole("button", { name: "Use theme colors" }));
    await waitFor(() => {
      snapshot = app.environment.services.shellPreferences.getSnapshot();
      expect(snapshot.iconPalette).toEqual({ mode: "follow-theme" });
      expect(snapshot.systemColorOverrides).toEqual({});
      expect(followIconColors.getAttribute("aria-pressed")).toBe("true");
      expect(document.documentElement.style.getPropertyValue("--plasmon-icon-primary")).toBe("#30264f");
    });
  } finally {
    app.dispose();
  }
});