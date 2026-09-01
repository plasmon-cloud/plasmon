// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  FILE_TYPE_ICON_ASSETS,
  SHORTCUT_OVERLAY_ASSET,
  SYSTEM_ICON_ASSETS,
} from "./assets.ts";
import {
  ICON_IMAGE_OBJECT_FIT,
  THUMBNAIL_OBJECT_FIT,
  composeShortcutPresentation,
  resolveImagePresentation,
} from "./presentation.ts";
import { ICON_CONTEXT_SIZE_TOKENS, iconContextCssVariables } from "./sizing.ts";

test("approved icon contexts map to the shared semantic size tokens", () => {
  expect(ICON_CONTEXT_SIZE_TOKENS).toEqual({
    desktop: { frame: "--plasmon-icon-desktop-frame", artwork: "--plasmon-icon-desktop-art" },
    "file-grid": { frame: "--plasmon-icon-grid-frame", artwork: "--plasmon-icon-grid-art" },
    "file-list": { frame: "--plasmon-icon-list-frame", artwork: "--plasmon-icon-list-art" },
    start: { frame: "--plasmon-icon-start-frame", artwork: "--plasmon-icon-start-art" },
    search: { frame: "--plasmon-icon-search-frame", artwork: "--plasmon-icon-search-art" },
    taskbar: { frame: "--plasmon-icon-taskbar-frame", artwork: "--plasmon-icon-taskbar-art" },
    titlebar: { frame: "--plasmon-icon-titlebar-frame", artwork: "--plasmon-icon-titlebar-art" },
    "context-menu": { frame: "--plasmon-icon-context-frame", artwork: "--plasmon-icon-context-art" },
    properties: { frame: "--plasmon-icon-properties-frame", artwork: "--plasmon-icon-properties-art" },
  });
  expect(iconContextCssVariables("desktop")).toEqual({
    "--plasmon-icon-frame-size": "var(--plasmon-icon-desktop-frame)",
    "--plasmon-icon-art-size": "var(--plasmon-icon-desktop-art)",
  });
});

test("visual-tokens.scss is the single numeric source for approved context sizes", () => {
  const tokens = readFileSync(new URL("../integration/visual-tokens.scss", import.meta.url), "utf8");
  for (const declaration of [
    "--plasmon-icon-desktop-frame: 48px", "--plasmon-icon-desktop-art: 42px",
    "--plasmon-icon-grid-frame: 44px", "--plasmon-icon-grid-art: 38px",
    "--plasmon-icon-list-frame: 26px", "--plasmon-icon-list-art: 22px",
    "--plasmon-icon-start-frame: 32px", "--plasmon-icon-start-art: 28px",
    "--plasmon-icon-search-frame: 30px", "--plasmon-icon-search-art: 26px",
    "--plasmon-icon-taskbar-frame: 30px", "--plasmon-icon-taskbar-art: 26px",
    "--plasmon-icon-titlebar-frame: 18px", "--plasmon-icon-titlebar-art: 16px",
    "--plasmon-icon-context-frame: 20px", "--plasmon-icon-context-art: 16px",
    "--plasmon-icon-properties-frame: 56px", "--plasmon-icon-properties-art: 46px",
  ]) expect(tokens).toContain(declaration);
});

test("shared native app chrome consumes the semantic Visual token vocabulary", () => {
  const css = readFileSync(new URL("./visual.scss", import.meta.url), "utf8");

  for (const selector of [
    ".plasmon-native-app-surface",
    ".plasmon-native-app-toolbar",
    ".plasmon-native-app-button",
    ".plasmon-native-app-status",
    ".plasmon-native-app-state",
    ".plasmon-native-app-panel",
  ]) expect(css).toContain(selector);

  for (const token of [
    "var(--plasmon-window-background)",
    "var(--plasmon-panel-background)",
    "var(--plasmon-panel-elevated)",
    "var(--plasmon-border-subtle)",
    "var(--plasmon-border-strong)",
    "var(--plasmon-text-primary)",
    "var(--plasmon-text-secondary)",
    "var(--plasmon-focus-ring)",
    "var(--plasmon-danger)",
    "var(--plasmon-radius-control)",
    "var(--plasmon-radius-panel)",
  ]) expect(css).toContain(token);
});

test("native artwork and thumbnails use contain instead of crop-to-fill", () => {
  expect(ICON_IMAGE_OBJECT_FIT).toBe("contain");
  expect(THUMBNAIL_OBJECT_FIT).toBe("contain");
});

test("failed image presentation changes to fallback without changing its source contract", () => {
  const src = "/apps/mail/static/icon.svg";
  expect(resolveImagePresentation(src, null)).toEqual({ kind: "image", src });
  expect(resolveImagePresentation(src, src)).toEqual({ kind: "fallback" });
  expect(resolveImagePresentation(null, null)).toEqual({ kind: "fallback" });
});

test("shortcut composition preserves the caller-resolved target identity", () => {
  const target = { kind: "native", src: "/apps/mail/static/icon.svg" } as const;
  const shortcut = composeShortcutPresentation(target);
  expect(shortcut.shortcut).toBe(true);
  expect(shortcut.target).toBe(target);
});

test("required visual assets are present without inventing DOS or emulator system apps", () => {
  expect(Object.keys(FILE_TYPE_ICON_ASSETS).sort()).toEqual([
    "atom", "audio", "dos-changes", "emulator-save-state", "file", "folder", "game-save", "image", "jsdos", "markdown", "rom-game", "text", "video",
  ]);
  expect(Object.keys(SYSTEM_ICON_ASSETS).sort()).toEqual([
    "application", "browser", "file-manager", "photos", "pin", "properties", "recycle-bin", "search", "settings", "start", "terminal",
  ]);
  expect("dos" in SYSTEM_ICON_ASSETS).toBe(false);
  expect("emulator" in SYSTEM_ICON_ASSETS).toBe(false);
  expect(SHORTCUT_OVERLAY_ASSET.endsWith("/shortcut-overlay.svg")).toBe(true);
});
