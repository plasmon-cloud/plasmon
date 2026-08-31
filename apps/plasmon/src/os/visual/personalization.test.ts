import { expect, test } from "bun:test";
import {
  cssColorToOpaqueHex,
  iconPaletteCssVariables,
  iconPaletteForTheme,
  isSystemPaletteCustom,
  normalizeSystemColorOverrides,
  normalizeVisualColor,
  normalizeVisualIconPalette,
  systemColorOverrideCssVariables,
  VISUAL_ICON_COLOR_SLOT_IDS,
  VISUAL_ICON_SET_IDS,
  VISUAL_SYSTEM_COLOR_ROLE_IDS,
} from "./personalization.ts";

const themeIds = [
  "plasmon-graphite",
  "plasmon-verdant",
  "plasmon-midnight",
  "plasmon-ember",
  "plasmon-glacier",
  "plasmon-rosewood",
] as const;

test("visual colors normalize to safe bounded hex values", () => {
  expect(normalizeVisualColor(" #AbC ")).toBe("#aabbcc");
  expect(normalizeVisualColor("#12ABef")).toBe("#12abef");
  expect(normalizeVisualColor("red")).toBeNull();
  expect(normalizeVisualColor("var(--plasmon-accent)")).toBeNull();
  expect(normalizeVisualColor("url(javascript:alert(1))")).toBeNull();
  expect(cssColorToOpaqueHex("rgba(255, 255, 255, 0.21)")).toBe("#ffffff");
});

test("system color overrides accept only the curated semantic role registry", () => {
  expect(VISUAL_SYSTEM_COLOR_ROLE_IDS).toEqual([
    "desktop",
    "window",
    "titlebar",
    "panel",
    "raised-surface",
    "control",
    "primary-text",
    "secondary-text",
    "accent",
    "border",
  ]);
  expect(normalizeSystemColorOverrides({
    desktop: "#ABC",
    accent: "#123456",
    border: "not-a-color",
    arbitraryCss: "url(evil)",
  })).toEqual({
    desktop: "#aabbcc",
    accent: "#123456",
  });
  expect(systemColorOverrideCssVariables({ arbitraryCss: "#ffffff" } as never)).toEqual({});
});

test("Custom system-theme state is derived only from effective system overrides", () => {
  const base = {
    desktop: "#101010",
    accent: "#62c5e8",
  } as const;
  expect(isSystemPaletteCustom(base, {})).toBe(false);
  expect(isSystemPaletteCustom(base, { accent: "#62c5e8" })).toBe(false);
  expect(isSystemPaletteCustom(base, { accent: "#123456" })).toBe(true);
  expect(isSystemPaletteCustom({ desktop: "#f5f7f8", accent: "#177e9f" }, { accent: "#62c5e8" })).toBe(true);
});

test("icon personalization keeps one truthful set and the canonical five #513 slots", () => {
  expect(VISUAL_ICON_SET_IDS).toEqual(["plasmon"]);
  expect(VISUAL_ICON_COLOR_SLOT_IDS).toEqual([
    "primary",
    "secondary",
    "accent",
    "outline",
    "highlight",
  ]);

  for (const themeId of themeIds) {
    const palette = iconPaletteForTheme(themeId);
    expect(normalizeVisualIconPalette(palette)).toEqual(palette);
    expect(Object.keys(iconPaletteCssVariables(palette)).sort()).toEqual([
      "--plasmon-icon-accent",
      "--plasmon-icon-highlight",
      "--plasmon-icon-outline",
      "--plasmon-icon-primary",
      "--plasmon-icon-secondary",
    ]);
  }
});

test("custom icon palette validation requires all five safe colors", () => {
  expect(normalizeVisualIconPalette({
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    outline: "#444444",
    highlight: "#555555",
  })).toEqual({
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    outline: "#444444",
    highlight: "#555555",
  });
  expect(normalizeVisualIconPalette({
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    outline: "#444444",
    highlight: "var(--theme)",
  })).toBeNull();
  expect(normalizeVisualIconPalette({ primary: "#111111" })).toBeNull();
});