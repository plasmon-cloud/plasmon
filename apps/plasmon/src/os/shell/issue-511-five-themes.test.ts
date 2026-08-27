// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  validateShellPreferences,
  type ShellThemeId,
} from "./preferences.ts";

const visualTokens = readFileSync(new URL("../integration/visual-tokens.scss", import.meta.url), "utf8");
const settingsSurface = readFileSync(new URL("./ShellSurfaces.tsx", import.meta.url), "utf8");

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

test("#511 exposes exactly five stable, individually named Shell themes", () => {
  expect(SHELL_THEME_IDS).toEqual([
    "plasmon-dark",
    "plasmon-midnight",
    "plasmon-ember",
    "plasmon-glacier",
    "plasmon-rosewood",
  ]);
  expect(Object.keys(SHELL_THEME_LABELS)).toEqual([...SHELL_THEME_IDS]);
  expect(new Set(Object.values(SHELL_THEME_LABELS)).size).toBe(5);
  expect(settingsSurface).toContain("SHELL_THEME_LABELS[themeId]");
});

test("#511 all five theme IDs remain valid filesystem-backed Shell preference values", () => {
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
});

test("#511 every theme overrides the complete shared color and elevation palette", () => {
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

test("#511 major assembled-surface colors are intentionally distinct across all five themes", () => {
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
    expect(new Set(values).size).toBe(5);
  }
});
