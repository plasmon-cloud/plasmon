// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  effectiveShellWallpaper,
  SHELL_THEME_IDS,
  SHELL_THEME_WALLPAPERS,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  validateShellPreferences,
} from "./preferences.ts";

const THEMES = [
  "plasmon-dark",
  "plasmon-midnight",
  "plasmon-ember",
  "plasmon-glacier",
  "plasmon-rosewood",
] as const;

const WALLPAPERS = [
  "plasmon-aurora",
  "midnight-orbit",
  "ember-horizon",
  "glacier-prism",
  "rosewood-bloom",
] as const;

function stored(wallpaper: unknown) {
  return {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-midnight",
    wallpaper,
    taskbarAlignment: "left",
  };
}

test("#512 defines exactly five stable wallpapers and a one-to-one theme mapping", () => {
  expect(SHELL_THEME_IDS).toEqual(THEMES);
  expect(SHELL_WALLPAPER_IDS).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_THEME_WALLPAPERS))).toEqual(new Set(WALLPAPERS));
  expect(Object.keys(SHELL_WALLPAPER_LABELS)).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_WALLPAPER_LABELS)).size).toBe(WALLPAPERS.length);
});

test("#512 Follow theme resolves from the active theme while pinned wallpaper remains independent", () => {
  for (const themeId of THEMES) {
    expect(effectiveShellWallpaper(themeId, { mode: "follow-theme" })).toBe(SHELL_THEME_WALLPAPERS[themeId]);
    expect(effectiveShellWallpaper(themeId, { mode: "pinned", id: "ember-horizon" })).toBe("ember-horizon");
  }
});

test("#512 legacy and corrupt wallpaper state migrates without erasing unrelated v1 preferences", () => {
  for (const legacy of ["aurora", "plain"]) {
    expect(validateShellPreferences(stored(legacy))).toEqual({
      ...stored({ mode: "follow-theme" }),
      wallpaper: { mode: "follow-theme" },
    });
  }

  expect(validateShellPreferences(stored({ mode: "pinned", id: "unknown" }))).toEqual({
    ...stored({ mode: "follow-theme" }),
    wallpaper: { mode: "follow-theme" },
  });

  expect(validateShellPreferences(stored({ mode: "pinned", id: "glacier-prism" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "glacier-prism" });
});

test("#512 wallpaper artwork stays compact generated CSS with all five distinct selectors", () => {
  const css = readFileSync(new URL("./wallpapers.scss", import.meta.url), "utf8");
  for (const wallpaperId of WALLPAPERS) {
    expect(css).toContain(`.plasmon-shell--wallpaper-${wallpaperId} .plasmon-shell__wallpaper`);
  }
  expect(css).not.toMatch(/url\s*\(/i);
  expect(css).not.toMatch(/\.(?:png|jpe?g|webp|gif)\b/i);
  expect(css).toContain("radial-gradient");
  expect(css).toContain("linear-gradient");
  expect(css).toContain("conic-gradient");
});

test("#512 Shell wallpaper remains exposed through the FileManager-owned desktop canvas", () => {
  const css = readFileSync(new URL("./wallpaper-visibility.scss", import.meta.url), "utf8");
  const style = readFileSync(new URL("../../../style.scss", import.meta.url), "utf8");

  expect(style).toContain('@use "./os/shell/wallpaper-visibility.scss";');
  expect(css).toContain('.plasmon-shell[class*="plasmon-shell--wallpaper-"] .plasmon-desktop');
  expect(css).toContain('.plasmon-shell[class*="plasmon-shell--wallpaper-"] .fm-root--desktop');
  expect(css).toContain("background: transparent;");
});

test("#512 Settings exposes Follow theme and every canonical wallpaper choice", () => {
  const surface = readFileSync(new URL("./ShellSurfaces.tsx", import.meta.url), "utf8");
  expect(surface).toContain(">Follow theme</button>");
  expect(surface).toContain("SHELL_WALLPAPER_IDS.map");
  expect(surface).toContain('preferences.wallpaper.mode === "pinned"');
  expect(surface).toContain('onSelectWallpaper({ mode: "follow-theme" })');
  expect(surface).toContain('onSelectWallpaper({ mode: "pinned", id: wallpaperId })');
});
