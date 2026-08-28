// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FILE_TYPE_ICON_ASSETS, SYSTEM_ICON_ASSETS } from "./assets.ts";
import {
  applicationResourcePresentation,
  nativeHandlerResourcePresentation,
  plasmonOwnedAssetPresentation,
} from "./resource-presentation.ts";

const iconTokens = readFileSync(new URL("./icon-tokens.scss", import.meta.url), "utf8");
const primitives = readFileSync(new URL("./primitives.tsx", import.meta.url), "utf8");
const themeIds = [
  "plasmon-dark",
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

function themeBlock(themeId: string): string {
  return iconTokens.match(
    new RegExp(`\\.plasmon-shell\\[data-plasmon-theme="${themeId}"\\]\\s*\\{([\\s\\S]*?)\\n\\s*\\}`),
  )?.[1] ?? "";
}

function tokenValue(block: string, token: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`${escaped}:\\s*([^;]+);`))?.[1]?.trim() ?? "";
}

test("#513 all five themes define distinct complete icon palettes", () => {
  for (const themeId of themeIds) {
    const block = themeBlock(themeId);
    expect(block).not.toBe("");
    for (const token of tokenNames) expect(tokenValue(block, token)).not.toBe("");
  }

  for (const token of tokenNames) {
    const values = themeIds.map((themeId) => tokenValue(themeBlock(themeId), token));
    expect(new Set(values).size).toBe(themeIds.length);
  }
});

test("#513 active icon palette reaches body-portaled owned artwork such as drag previews", () => {
  for (const themeId of themeIds) {
    expect(iconTokens).toContain(
      `:root:has(.plasmon-shell[data-plasmon-theme="${themeId}"])`,
    );
  }
});

test("#513 canonical Plasmon asset references resolve to owned semantic artwork", () => {
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

test("#513 first-party native identity stays owned while unknown/authored identity stays external", () => {
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

test("#513 production primitives inline owned SVG but preserve authored images", () => {
  expect(primitives).toContain("<OwnedSystemIcon icon={icon}");
  expect(primitives).toContain("<OwnedFileTypeIcon icon={icon}");
  expect(primitives).toContain("<OwnedShortcutOverlay");
  expect(primitives).toContain("plasmon-native-app-icon");
  expect(primitives).toContain("plasmon-media-thumbnail");
  expect(primitives).toContain("<img");
  expect(primitives).not.toContain("src={SYSTEM_ICON_ASSETS[icon]}");
  expect(primitives).not.toContain("src={FILE_TYPE_ICON_ASSETS[icon]}");
});
