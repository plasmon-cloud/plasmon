// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FILE_TYPE_ICON_ASSETS, SYSTEM_ICON_ASSETS } from "./assets.ts";
import {
  iconPaletteCssVariables,
  iconPaletteForTheme,
  VISUAL_ICON_COLOR_SLOT_IDS,
  VISUAL_ICON_SET_IDS,
} from "./personalization.ts";
import {
  applicationResourcePresentation,
  nativeHandlerResourcePresentation,
  plasmonOwnedAssetPresentation,
} from "./resource-presentation.ts";

const iconTokens = readFileSync(new URL("./icon-tokens.scss", import.meta.url), "utf8");
const personalizationStyles = readFileSync(new URL("./personalization.scss", import.meta.url), "utf8");
const primitives = readFileSync(new URL("./primitives.tsx", import.meta.url), "utf8");
const themeIds = [
  "plasmon-graphite",
  "plasmon-verdant",
  "plasmon-midnight",
  "plasmon-ember",
  "plasmon-glacier",
  "plasmon-rosewood",
] as const;
const tokenNames = [
  "--plasmon-icon-primary",
  "--plasmon-icon-secondary",
  "--plasmon-icon-accent",
  "--plasmon-icon-outline",
  "--plasmon-icon-highlight",
] as const;

test("all six themes derive distinct complete canonical icon palettes from one Visual registry", () => {
  expect(VISUAL_ICON_SET_IDS).toEqual(["plasmon"]);
  expect(VISUAL_ICON_COLOR_SLOT_IDS).toEqual([
    "primary",
    "secondary",
    "accent",
    "outline",
    "highlight",
  ]);

  const valuesByToken = new Map<string, string[]>();
  for (const token of tokenNames) valuesByToken.set(token, []);

  for (const themeId of themeIds) {
    const variables = iconPaletteCssVariables(iconPaletteForTheme(themeId));
    expect(Object.keys(variables).sort()).toEqual([...tokenNames].sort());
    for (const token of tokenNames) valuesByToken.get(token)?.push(variables[token]!);
  }

  for (const token of tokenNames) {
    expect(new Set(valuesByToken.get(token)).size).toBe(themeIds.length);
  }
});

test("Graphite remains the CSS fallback while runtime projection owns active Follow-theme or Custom colors", () => {
  expect(iconTokens).toContain("--plasmon-icon-primary: #2c3137;");
  expect(iconTokens).toContain("--plasmon-icon-secondary: #747b84;");
  expect(iconTokens).toContain("--plasmon-icon-accent: #62c5e8;");
  expect(iconTokens).not.toContain("data-plasmon-theme");
  expect(personalizationStyles).toContain('data-plasmon-icon-palette-projected="true"');
  for (const token of tokenNames) expect(personalizationStyles).toContain(`${token}: inherit;`);
});

test("active icon palette reaches body-portaled owned artwork through the document-root seam", () => {
  const graphite = iconPaletteCssVariables(iconPaletteForTheme("plasmon-graphite"));
  expect(graphite["--plasmon-icon-primary"]).toBe("#2c3137");
  expect(graphite["--plasmon-icon-secondary"]).toBe("#747b84");
  expect(graphite["--plasmon-icon-accent"]).toBe("#62c5e8");
  expect(personalizationStyles).toContain(":root[data-plasmon-icon-palette-projected=\"true\"]");
});

test("canonical Plasmon asset references resolve to owned semantic artwork", () => {
  expect(plasmonOwnedAssetPresentation(FILE_TYPE_ICON_ASSETS.folder)).toEqual({
    kind: "file-type",
    icon: "folder",
  });
  expect(plasmonOwnedAssetPresentation(SYSTEM_ICON_ASSETS["file-manager"])).toEqual({
    kind: "system",
    icon: "file-manager",
  });
  expect(plasmonOwnedAssetPresentation("/apps/example/custom-icon.svg")).toBeNull();
});

test("first-party native identity stays owned while unknown/authored identity stays external", () => {
  expect(nativeHandlerResourcePresentation("native:explorer", SYSTEM_ICON_ASSETS["file-manager"])).toEqual({
    kind: "system",
    icon: "file-manager",
  });

  expect(nativeHandlerResourcePresentation("native:third-party", "/apps/example/custom-icon.svg")).toEqual({
    kind: "application",
    src: "/apps/example/custom-icon.svg",
  });
  expect(applicationResourcePresentation("/apps/example/custom-icon.svg")).toEqual({
    kind: "application",
    src: "/apps/example/custom-icon.svg",
  });
});

test("production primitives inline owned SVG but preserve authored images", () => {
  expect(primitives).toContain("<OwnedSystemIcon icon={icon}");
  expect(primitives).toContain("<OwnedFileTypeIcon icon={icon}");
  expect(primitives).toContain("<OwnedShortcutOverlay");
  expect(primitives).toContain("plasmon-native-app-icon");
  expect(primitives).toContain("plasmon-media-thumbnail");
  expect(primitives).toContain("<img");
  expect(primitives).not.toContain("src={SYSTEM_ICON_ASSETS[icon]}");
  expect(primitives).not.toContain("src={FILE_TYPE_ICON_ASSETS[icon]}");
});