// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  validateShellPreferences,
  type ShellThemeId,
} from "./preferences.ts";

const visualTokens = [
  readFileSync(new URL("../integration/visual-tokens.scss", import.meta.url), "utf8"),
  readFileSync(new URL("../integration/theme-graphite.scss", import.meta.url), "utf8"),
].join("\n");
const settingsSurface = readFileSync(new URL("./ShellSurfaces.tsx", import.meta.url), "utf8");
const fileManagerStyles = readFileSync(new URL("../file-manager/file-manager.scss", import.meta.url), "utf8");
const windowingStyles = readFileSync(new URL("../windowing/windowing.scss", import.meta.url), "utf8");

const THEME_PALETTE_TOKENS = [
  "--plasmon-desktop-background:",
  "--plasmon-panel-background:",
  "--plasmon-panel-elevated:",
  "--plasmon-window-background:",
  "--plasmon-window-titlebar:",
  "--plasmon-taskbar-background:",
  "--plasmon-control-background:",
  "--plasmon-control-hover:",
  "--plasmon-border-subtle:",
  "--plasmon-border-strong:",
  "--plasmon-text-primary:",
  "--plasmon-text-secondary:",
  "--plasmon-text-subtle:",
  "--plasmon-text-disabled:",
  "--plasmon-accent:",
  "--plasmon-accent-hover:",
  "--plasmon-accent-ink:",
  "--plasmon-selection:",
  "--plasmon-selection-border:",
  "--plasmon-focus-ring:",
  "--plasmon-danger:",
  "--plasmon-warning:",
  "--plasmon-success:",
  "--plasmon-shadow-window:",
  "--plasmon-shadow-panel:",
  "--plasmon-shadow-icon:",
] as const;

function themeBlock(themeId: ShellThemeId): string {
  return visualTokens.match(
    new RegExp(`\\.plasmon-shell\\[data-plasmon-theme="${themeId}"\\]\\s*\\{([\\s\\S]*?)\\n\\s*\\}`),
  )?.[1] ?? "";
}

function tokenValue(block: string, token: string): string {
  const name = token.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() ?? "";
}

test("exposes exactly six stable, individually named Shell themes with Graphite as default", () => {
  expect(SHELL_THEME_IDS).toEqual([
    "plasmon-graphite",
    "plasmon-verdant",
    "plasmon-midnight",
    "plasmon-ember",
    "plasmon-glacier",
    "plasmon-rosewood",
  ]);
  expect(SHELL_THEME_LABELS["plasmon-graphite"]).toBe("Graphite");
  expect(SHELL_THEME_LABELS["plasmon-verdant"]).toBe("Verdant");
  expect(DEFAULT_SHELL_PREFERENCES.themeId).toBe("plasmon-graphite");
  expect(Object.keys(SHELL_THEME_LABELS)).toEqual([...SHELL_THEME_IDS]);
  expect(new Set(Object.values(SHELL_THEME_LABELS)).size).toBe(6);
  expect(settingsSurface).toContain("SHELL_THEME_LABELS[themeId]");
});

test("all six theme IDs remain valid filesystem-backed Shell preference values", () => {
  for (const themeId of SHELL_THEME_IDS) {
    expect(validateShellPreferences({
      version: 1,
      pinnedNative: [],
      pinnedElements: [],
      themeId,
      wallpaper: "aurora",
      taskbarAlignment: "center",
    })?.themeId).toBe(themeId);
  }

  expect(validateShellPreferences({
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: "plasmon-dark",
    wallpaper: "aurora",
    taskbarAlignment: "center",
  })?.themeId).toBe("plasmon-verdant");
});

test("every theme overrides the complete shared color and elevation palette", () => {
  for (const themeId of SHELL_THEME_IDS) {
    const block = themeBlock(themeId);
    expect(block).not.toBe("");
    for (const token of THEME_PALETTE_TOKENS) expect(block).toContain(token);
  }

  expect(themeBlock("plasmon-glacier")).toContain("color-scheme: light;");
  for (const themeId of SHELL_THEME_IDS.filter((id) => id !== "plasmon-glacier")) {
    expect(themeBlock(themeId)).toContain("color-scheme: dark;");
  }
});

test("Graphite is grayscale-led with a distinct colored accent", () => {
  const graphite = themeBlock("plasmon-graphite");
  expect(tokenValue(graphite, "--plasmon-window-background:")).toBe("#15171a");
  expect(tokenValue(graphite, "--plasmon-window-titlebar:")).toBe("#24272c");
  expect(tokenValue(graphite, "--plasmon-text-primary:")).toBe("#f6f7f8");
  expect(tokenValue(graphite, "--plasmon-accent:")).toBe("#62c5e8");
});

test("major assembled-surface colors are intentionally distinct across all six themes", () => {
  for (const token of [
    "--plasmon-desktop-background:",
    "--plasmon-window-background:",
    "--plasmon-window-titlebar:",
    "--plasmon-panel-elevated:",
    "--plasmon-accent:",
    "--plasmon-text-primary:",
  ]) {
    const values = SHELL_THEME_IDS.map((themeId) => tokenValue(themeBlock(themeId), token));
    expect(values.every(Boolean)).toBe(true);
    expect(new Set(values).size).toBe(6);
  }
});

test("FileManager and Explorer consume the shared theme palette rather than a fixed dark palette", () => {
  for (const token of [
    "var(--plasmon-desktop-background)",
    "var(--plasmon-window-background)",
    "var(--plasmon-panel-background)",
    "var(--plasmon-panel-elevated)",
    "var(--plasmon-control-background)",
    "var(--plasmon-control-hover)",
    "var(--plasmon-border-subtle)",
    "var(--plasmon-border-strong)",
    "var(--plasmon-text-primary)",
    "var(--plasmon-text-secondary)",
    "var(--plasmon-text-subtle)",
    "var(--plasmon-selection)",
    "var(--plasmon-selection-border)",
    "var(--plasmon-focus-ring)",
    "var(--plasmon-danger)",
  ]) expect(fileManagerStyles).toContain(token);

  for (const retiredColor of [
    "#0d1320",
    "#111827",
    "#151c2b",
    "#75a7ff",
    "#eef3fb",
    "#171f30",
  ]) expect(fileManagerStyles.toLowerCase()).not.toContain(retiredColor);

  expect(fileManagerStyles).toContain(
    ".plasmon-desktop { position: relative; width: 100%; height: 100%; min-height: 320px; overflow: hidden; background: var(--plasmon-desktop-background); }",
  );
});

test("Windowing consumes explicit native-window titlebar and content theme semantics", () => {
  for (const token of [
    "var(--plasmon-window-background)",
    "var(--plasmon-window-titlebar)",
    "var(--plasmon-border-subtle)",
    "var(--plasmon-border-strong)",
    "var(--plasmon-text-primary)",
    "var(--plasmon-control-hover)",
    "var(--plasmon-selection)",
    "var(--plasmon-selection-border)",
    "var(--plasmon-focus-ring)",
    "var(--plasmon-danger)",
  ]) expect(windowingStyles).toContain(token);

  expect(windowingStyles).not.toContain("var(--plasmon-surface-elevated");
  expect(windowingStyles).not.toContain("var(--plasmon-surface,");
  expect(windowingStyles).not.toContain("var(--plasmon-text,");
});
