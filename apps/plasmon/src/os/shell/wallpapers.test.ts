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
  SHELL_WALLPAPER_LAYOUTS,
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

const WALLPAPERS = ["graphite-sand", ...GENERATED_WALLPAPERS] as const;

function stored(wallpaper: unknown, themeId: unknown = "plasmon-midnight", wallpaperLayout?: unknown) {
  return {
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId,
    appearanceMode: "dark",
    wallpaper,
    ...(wallpaperLayout === undefined ? {} : { wallpaperLayout }),
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
  expect(DEFAULT_SHELL_PREFERENCES.themeId).toBe("plasmon-graphite");
  expect(DEFAULT_SHELL_PREFERENCES.appearanceMode).toBe("dark");
  expect(DEFAULT_SHELL_PREFERENCES.wallpaper).toEqual({ mode: "pinned", id: "rosewood-bloom" });
  expect(DEFAULT_SHELL_PREFERENCES.wallpaperLayout).toBe("fill");
  expect(effectiveShellWallpaper(DEFAULT_SHELL_PREFERENCES.themeId, DEFAULT_SHELL_PREFERENCES.wallpaper))
    .toBe("rosewood-bloom");
  expect(SHELL_THEME_WALLPAPERS["plasmon-graphite"]).toBe("graphite-sand");
  expect(effectiveShellWallpaper("plasmon-graphite", { mode: "follow-theme" })).toBe("graphite-sand");
});

test("Follow theme and filesystem fallback resolve from the active theme while built-in pinning stays independent", () => {
  for (const themeId of THEMES) {
    expect(effectiveShellWallpaper(themeId, { mode: "follow-theme" })).toBe(SHELL_THEME_WALLPAPERS[themeId]);
    expect(effectiveShellWallpaper(themeId, { mode: "filesystem", nodeId: "node-image" })).toBe(SHELL_THEME_WALLPAPERS[themeId]);
    expect(effectiveShellWallpaper(themeId, { mode: "pinned", id: "graphite-sand" })).toBe("graphite-sand");
  }
});

test("legacy preferences migrate to Fill while stable filesystem NodeId targets persist", () => {
  expect(validateShellPreferences(stored({ mode: "filesystem", nodeId: "node-image" }))).toMatchObject({
    wallpaper: { mode: "filesystem", nodeId: "node-image" },
    wallpaperLayout: "fill",
    themeId: "plasmon-midnight",
    appearanceMode: "dark",
  });
  expect(validateShellPreferences(stored({ mode: "filesystem", nodeId: "node-image" }, "plasmon-midnight", "tile")))
    ?.wallpaperLayout.toBe("tile");
  expect(validateShellPreferences(stored({ mode: "filesystem", nodeId: "" })))?.wallpaper)
    .toEqual({ mode: "follow-theme" });
  expect(validateShellPreferences(stored({ mode: "pinned", id: "plasmon-aurora" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "plasmon-lattice" });
  expect(validateShellPreferences(stored({ mode: "pinned", id: "digital-dusk" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "graphite-sand" });
  expect(validateShellPreferences(stored({ mode: "follow-theme" }, "plasmon-dark"))?.themeId)
    .toBe("plasmon-verdant");
  expect(validateShellPreferences(stored({ mode: "follow-theme" }, "plasmon-midnight", "span"))).toBeNull();
});

test("supports exactly Fill Fit Stretch Tile and Center with Fill as the compatibility default", () => {
  expect(SHELL_WALLPAPER_LAYOUTS).toEqual(["fill", "fit", "stretch", "tile", "center"]);
  const css = readFileSync(new URL("./wallpapers.scss", import.meta.url), "utf8");
  expect(css).toContain("plasmon-shell--wallpaper-layout-fill");
  expect(css).toContain("background-size: cover;");
  expect(css).toContain("plasmon-shell--wallpaper-layout-fit");
  expect(css).toContain("background-size: contain;");
  expect(css).toContain("plasmon-shell--wallpaper-layout-stretch");
  expect(css).toContain("background-size: 100% 100%;");
  expect(css).toContain("plasmon-shell--wallpaper-layout-tile");
  expect(css).toContain("background-repeat: repeat;");
  expect(css).toContain("plasmon-shell--wallpaper-layout-center");
  expect(css).not.toContain("wallpaper-layout-span");
});

test("uses packaged image artwork for all six built-ins without coupling artwork to layout", () => {
  const css = readFileSync(new URL("./wallpapers.scss", import.meta.url), "utf8");
  for (const wallpaperId of GENERATED_WALLPAPERS) {
    expect(css).toContain(`.plasmon-shell--wallpaper-${wallpaperId} .plasmon-shell__wallpaper`);
    expect(css).toContain(`url("static/plasmon/wallpapers/${wallpaperId}.svg")`);
  }
  expect(css).toContain('url("static/plasmon/wallpapers/graphite-sand.jpg")');
  expect(css.match(/\.(?:svg|jpe?g)\b/gi)?.length).toBe(6);
});

test("Graphite Sand packages the exact selected raster artwork without pretending it is an SVG", () => {
  const photo = readFileSync(new URL("../../../public/static/plasmon/wallpapers/graphite-sand.jpg", import.meta.url));
  expect(photo[0]).toBe(0xff);
  expect(photo[1]).toBe(0xd8);
  const eoiIndex = photo.findIndex((byte, index) => byte === 0xff && photo[index + 1] === 0xd9);
  expect(eoiIndex).toBeGreaterThan(1);
  expect(photo.byteLength).toBe(63_590);
});

test("Settings exposes representative built-in thumbnails filesystem choice and independent layout controls", () => {
  const settings = readFileSync(new URL("../../native-apps/settings/WallpaperPersonalization.tsx", import.meta.url), "utf8");
  expect(settings).toContain("SHELL_WALLPAPER_IDS.map");
  expect(settings).toContain("wallpaperAsset(wallpaperId)");
  expect(settings).toContain('aria-label={SHELL_WALLPAPER_LABELS[wallpaperId]}');
  expect(settings).toContain('aria-pressed={preferences.wallpaper.mode === "follow-theme"}');
  expect(settings).toContain("Choose filesystem image");
  expect(settings).toContain('mode: "filesystem", nodeId: node.id');
  expect(settings).toContain("SHELL_WALLPAPER_LAYOUTS.map");
});
