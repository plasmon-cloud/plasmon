// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  effectiveShellWallpaper,
  SHELL_JPG_WALLPAPER_ID,
  SHELL_THEME_IDS,
  SHELL_THEME_WALLPAPER_IDS,
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

const GENERATED_WALLPAPERS = [
  "plasmon-lattice",
  "midnight-orbit",
  "ember-horizon",
  "glacier-prism",
  "rosewood-bloom",
] as const;

const WALLPAPERS = [
  ...GENERATED_WALLPAPERS,
  "digital-dusk",
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

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda || offset + 1 >= bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrame.has(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

test("#512 keeps exactly five generated theme companions plus one optional compact JPG", () => {
  expect(SHELL_THEME_IDS).toEqual(THEMES);
  expect(SHELL_THEME_WALLPAPER_IDS).toEqual(GENERATED_WALLPAPERS);
  expect(SHELL_JPG_WALLPAPER_ID).toBe("digital-dusk");
  expect(SHELL_WALLPAPER_IDS).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_THEME_WALLPAPERS))).toEqual(new Set(GENERATED_WALLPAPERS));
  expect(new Set(Object.values(SHELL_THEME_WALLPAPERS)).has(SHELL_JPG_WALLPAPER_ID)).toBe(false);
  expect(Object.keys(SHELL_WALLPAPER_LABELS)).toEqual(WALLPAPERS);
  expect(new Set(Object.values(SHELL_WALLPAPER_LABELS)).size).toBe(WALLPAPERS.length);
});

test("#512 Follow theme resolves from the active theme while any pinned wallpaper remains independent", () => {
  for (const themeId of THEMES) {
    expect(effectiveShellWallpaper(themeId, { mode: "follow-theme" })).toBe(SHELL_THEME_WALLPAPERS[themeId]);
    expect(effectiveShellWallpaper(themeId, { mode: "pinned", id: "digital-dusk" })).toBe("digital-dusk");
  }
});

test("#512 legacy, preview, and corrupt wallpaper state migrates without erasing unrelated v1 preferences", () => {
  for (const legacy of ["aurora", "plain"]) {
    expect(validateShellPreferences(stored(legacy))).toEqual({
      ...stored({ mode: "follow-theme" }),
      wallpaper: { mode: "follow-theme" },
    });
  }

  expect(validateShellPreferences(stored({ mode: "pinned", id: "plasmon-aurora" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "plasmon-lattice" });

  expect(validateShellPreferences(stored({ mode: "pinned", id: "unknown" }))).toEqual({
    ...stored({ mode: "follow-theme" }),
    wallpaper: { mode: "follow-theme" },
  });

  expect(validateShellPreferences(stored({ mode: "pinned", id: "glacier-prism" }))?.wallpaper)
    .toEqual({ mode: "pinned", id: "glacier-prism" });
});

test("#512 five generated designs stay distinct while the JPG and Plasmon watermark are explicit", () => {
  const css = readFileSync(new URL("./wallpapers.scss", import.meta.url), "utf8");
  for (const wallpaperId of GENERATED_WALLPAPERS) {
    expect(css).toContain(`.plasmon-shell--wallpaper-${wallpaperId} .plasmon-shell__wallpaper`);
  }
  expect(css).toContain("radial-gradient");
  expect(css).toContain("linear-gradient");
  expect(css).toContain("conic-gradient");
  expect(css).toContain("repeating-linear-gradient");
  expect(css).toContain(".plasmon-shell--wallpaper-digital-dusk .plasmon-shell__wallpaper");
  expect(css).toContain('url("/static/plasmon/wallpapers/digital-dusk.jpg")');
  expect(css).toContain('content: "PLASMON";');
  expect(css).toContain('url("/static/plasmon/plasmon-mark.svg")');
  expect(css).not.toMatch(/\.(?:png|webp|gif)\b/i);
  expect(css.match(/\.jpe?g\b/gi)?.length).toBe(1);
});

test("#512 Digital Dusk is a compact high-resolution raster asset rather than a flattened vector-style placeholder", () => {
  const photo = readFileSync(new URL("../../../public/static/plasmon/wallpapers/digital-dusk.jpg", import.meta.url));
  expect(photo[0]).toBe(0xff);
  expect(photo[1]).toBe(0xd8);
  expect(photo.byteLength).toBeLessThan(225 * 1024);
  const dimensions = jpegDimensions(photo);
  expect(dimensions).not.toBeNull();
  expect(dimensions!.width).toBeGreaterThanOrEqual(1440);
  expect(dimensions!.height).toBeGreaterThanOrEqual(800);
  expect(Math.abs((dimensions!.width / dimensions!.height) - (16 / 9))).toBeLessThan(0.01);
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
