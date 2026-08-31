// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SHELL_PREFERENCES,
  effectiveShellWallpaper,
  SHELL_GENERATED_WALLPAPER_IDS,
  SHELL_JPG_WALLPAPER_ID,
  SHELL_THEME_IDS,
  SHELL_THEME_WALLPAPER_IDS,
  SHELL_THEME_WALLPAPERS,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  validateShellPreferences,
} from "./preferences.ts";

const THEMES = [
  "plasmon-graphite",
  "plasmon-verdant",
  "plasmon-midnight",
  "plasmon-ember",
  "plasmon-glacier",
  "plasmon-rosewood",
] as const;

const GENERATED_WALLPAPERS = [
  "plasmon-lattice",
  "midnight-orbit",
  "ember-horizon",
  "glacier-prism",
  "rosewood-bloom",
] as const;

const WALLPAPERS = [
  "graphite-sand",
  ...GENERATED_WALLPAPERS,
] as const;

function stored(wallpaper: unknown, themeId: unknown = "plasmon-midnight") {
  return {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId,
    appearanceMode: "dark",
    wallpaper,
    taskbarAlignment: "left",
  };
}

test("exposes six theme companions while fresh profiles pin Rosewood Bloom independently", () => {
  expect(SHELL_THEME_IDS).toEqual(THEMES);
  expect(SHELL_GENERATED_WALLPAPER_IDS).toEqual(GENERATED_WALLPAPERS);
  expect(SHELL_JPG_WALLPAPER_ID).toBe("graphite-sand");
  expect(SHELL_WALLPAPER_IDS).toEqual(WALLPAPERS);
  expect(SHELL_THEME_WALLPAPER_IDS).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_THEME_WALLPAPERS))).toEqual(new Set(WALLPAPERS));
  expect(Object.keys(SHELL_WALLPAPER_LABELS)).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_WALLPAPER_LABELS)).size).toBe(WALLPAPERS.length);
  expect(DEFAULT_SHELL_PREFERENCES.themeId).toBe("plasmon-graphite");
  expect(DEFAULT_SHELL_PREFERENCES.appearanceMode).toBe("dark");
  expect(DEFAULT_SHELL_PREFERENCES.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
  expect(effectiveShellWallpaper(DEFAULT_SHELL_PREFERENCES.themeId, DEFAULT_SHELL_PREFERENCES.wallpaper))
    .toBe("rosewood-bloom");
  expect(SHELL_THEME_WALLPAPERS["plasmon-graphite"]).toBe("graphite-sand");
  expect(effectiveShellWallpaper("plasmon-graphite", { mode: "follow-theme" })).toBe("graphite-sand");
  expect(SHELL_THEME_WALLPAPERS["plasmon-verdant"]).toBe("plasmon-lattice");
});

test("Follow theme resolves from the active theme while any pinned wallpaper remains independent", () => {
  for (const themeId of THEMES) {
    expect(effectiveShellWallpaper(themeId, { mode: "follow-theme" })).toBe(SHELL_THEME_WALLPAPERS[themeId]);
    expect(effectiveShellWallpaper(themeId, { mode: "pinned", id: "graphite-sand" })).toBe("graphite-sand");
  }
});

test("legacy, preview, and corrupt wallpaper state migrates without erasing unrelated v1 preferences", () => {
  for (const legacy of ["aurora", "plain"]) {
    expect(validateShellPreferences(stored(legacy))).toEqual({
      ...stored({ mode: "follow-theme" }),
      wallpaper: { mode: "follow-theme" },
      showBrandWatermark: true,
    });
  }

  expect(validateShellPreferences(stored({ mode: "pinned", id: "plasmon-aurora" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "plasmon-lattice" });
  expect(validateShellPreferences(stored({ mode: "pinned", id: "digital-dusk" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "graphite-sand" });
  expect(validateShellPreferences(stored({ mode: "follow-theme" }, "plasmon-dark"))?.themeId)
    .toBe("plasmon-verdant");

  expect(validateShellPreferences(stored({ mode: "pinned", id: "unknown" }))).toEqual({
    ...stored({ mode: "follow-theme" }),
    wallpaper: { mode: "follow-theme" },
    showBrandWatermark: true,
  });

  expect(validateShellPreferences(stored({ mode: "pinned", id: "glacier-prism" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "glacier-prism" });
});

test("uses packaged image artwork for all six wallpapers with uniform cover rendering", () => {
  const css = readFileSync(new URL("./wallpapers.scss", import.meta.url), "utf8");
  for (const wallpaperId of GENERATED_WALLPAPERS) {
    expect(css).toContain(`.plasmon-shell--wallpaper-${wallpaperId} .plasmon-shell__wallpaper`);
    expect(css).toContain(`url("static/plasmon/wallpapers/${wallpaperId}.svg") center / cover no-repeat`);
  }
  expect(css).toContain(".plasmon-shell--wallpaper-graphite-sand .plasmon-shell__wallpaper");
  expect(css).toContain('url("static/plasmon/wallpapers/graphite-sand.jpg") center 50% / cover no-repeat');
  expect(css).not.toMatch(/gradient|\.(?:png|webp|gif)\b/i);
  expect(css.match(/\.(?:svg|jpe?g)\b/gi)?.length).toBe(6);
});

test("Graphite Sand packages the exact selected raster artwork without pretending it is an SVG", () => {
  const photo = readFileSync(new URL("../../../public/static/plasmon/wallpapers/graphite-sand.jpg", import.meta.url));
  expect(photo[0]).toBe(0xff);
  expect(photo[1]).toBe(0xd8);
  const eoiIndex = photo.findIndex((byte, index) => byte === 0xff && photo[index + 1] === 0xd9);
  expect(eoiIndex).toBeGreaterThan(1);
  expect(photo.byteLength).toBe(63_590);
  expect(photo.subarray(0, 256).toString("utf8")).not.toContain("<svg");
});

test("Plasmon watermark is a separate bottom-right SVG overlay with a persisted Settings toggle", () => {
  const overlay = readFileSync(new URL("./desktop-overlays.scss", import.meta.url), "utf8");
  const surface = readFileSync(new URL("./ShellSurfaces.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("./Shell.tsx", import.meta.url), "utf8");
  const style = readFileSync(new URL("../../style.scss", import.meta.url), "utf8");
  const watermark = readFileSync(new URL("../../../public/static/plasmon/plasmon-watermark.svg", import.meta.url), "utf8");

  expect(style).toContain('@use "./os/shell/desktop-overlays.scss";');
  expect(overlay).toContain('data-plasmon-brand-watermark="visible"');
  expect(overlay).toContain('url("static/plasmon/plasmon-watermark.svg")');
  expect(overlay).toContain("right: 24px;");
  expect(shell).toContain("data-plasmon-brand-watermark");
  expect(surface).toContain('aria-label="Show Plasmon watermark"');
  expect(surface).toContain("onSetBrandWatermark");
  expect(watermark).toContain("<svg");
});

test("Shell wallpaper remains exposed through the FileManager-owned desktop canvas", () => {
  const css = readFileSync(new URL("./wallpaper-visibility.scss", import.meta.url), "utf8");
  const style = readFileSync(new URL("../../style.scss", import.meta.url), "utf8");

  expect(style).toContain('@use "./os/shell/wallpaper-visibility.scss";');
  expect(css).toContain('.plasmon-shell[class*="plasmon-shell--wallpaper-"] .plasmon-desktop');
  expect(css).toContain('.plasmon-shell[class*="plasmon-shell--wallpaper-"] .fm-root--desktop');
  expect(css).toContain("background: transparent;");
});

test("Settings exposes Follow theme and every canonical wallpaper choice", () => {
  const surface = readFileSync(new URL("./ShellSurfaces.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("./Shell.tsx", import.meta.url), "utf8");
  expect(surface).toContain(">Follow theme</button>");
  expect(surface).toContain("SHELL_WALLPAPER_IDS.map");
  expect(surface).toContain('preferences.wallpaper.mode === "pinned"');
  expect(surface).toContain("selectedWallpaperId === wallpaperId");
  expect(surface).toContain('disabled={!preferencesReady || preferences.wallpaper.mode === "follow-theme"}');
  expect(readFileSync(new URL("./shell.scss", import.meta.url), "utf8"))
    .toContain('.plasmon-shell__grid > button[aria-pressed="true"]');
  expect(surface).toContain('onSelectWallpaper({ mode: "follow-theme" })');
  expect(surface).toContain('onSelectWallpaper({ mode: "pinned", id: wallpaperId })');
  expect(shell).toContain("WALLPAPER_ASSET_PATHS.map");
  expect(shell).toContain("const image = new Image();");
});
