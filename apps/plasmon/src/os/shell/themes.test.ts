// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_APPEARANCE_MODES,
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  validateShellPreferences,
  type ShellAppearanceMode,
  type ShellThemeId,
} from "./preferences.ts";

const appearanceTokens = readFileSync(new URL("../integration/theme-appearance.scss", import.meta.url), "utf8");
const visualStyles = readFileSync(new URL("../visual/visual.scss", import.meta.url), "utf8");
const adaptiveStyles = readFileSync(new URL("../visual/adaptive-surfaces.scss", import.meta.url), "utf8");
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
  "--plasmon-control-disabled-background:",
  "--plasmon-control-disabled-border:",
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
  "--plasmon-selection-text:",
  "--plasmon-focus-ring:",
  "--plasmon-danger:",
  "--plasmon-warning:",
  "--plasmon-success:",
  "--plasmon-scrollbar-track:",
  "--plasmon-scrollbar-thumb:",
  "--plasmon-scrollbar-thumb-hover:",
  "--plasmon-shadow-window:",
  "--plasmon-shadow-panel:",
  "--plasmon-shadow-icon:",
] as const;

function appearanceBlock(themeId: ShellThemeId, appearanceMode: ShellAppearanceMode): string {
  return appearanceTokens.match(
    new RegExp(
      `\\.plasmon-shell\\[data-plasmon-theme="${themeId}"\\]\\[data-plasmon-appearance="${appearanceMode}"\\]\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
    ),
  )?.[1] ?? "";
}

function tokenValue(block: string, token: string): string {
  const name = token.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() ?? "";
}

function rgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Expected six-digit hex color, received ${hex}`);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const channels = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function validPreference(appearanceMode?: unknown) {
  return {
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: "plasmon-graphite",
    ...(appearanceMode === undefined ? {} : { appearanceMode }),
    wallpaper: { mode: "follow-theme" },
    taskbarAlignment: "center",
  };
}

test("keeps exactly six stable theme identities and an independent two-value appearance mode", () => {
  expect(SHELL_THEME_IDS).toEqual([
    "plasmon-graphite",
    "plasmon-verdant",
    "plasmon-midnight",
    "plasmon-ember",
    "plasmon-glacier",
    "plasmon-rosewood",
  ]);
  expect(SHELL_APPEARANCE_MODES).toEqual(["dark", "light"]);
  expect(DEFAULT_SHELL_PREFERENCES.themeId).toBe("plasmon-graphite");
  expect(DEFAULT_SHELL_PREFERENCES.appearanceMode).toBe("dark");
  expect(Object.keys(SHELL_THEME_LABELS)).toEqual([...SHELL_THEME_IDS]);
  expect(new Set(Object.values(SHELL_THEME_LABELS)).size).toBe(6);
  expect(SHELL_THEME_IDS).not.toContain("custom" as ShellThemeId);

  expect(validateShellPreferences(validPreference())?.appearanceMode).toBe("dark");
  expect(validateShellPreferences(validPreference("dark"))?.appearanceMode).toBe("dark");
  expect(validateShellPreferences(validPreference("light"))?.appearanceMode).toBe("light");
  expect(validateShellPreferences(validPreference("system"))).toBeNull();
});

test("all six themes expose complete Dark and Light shared semantic palettes", () => {
  for (const themeId of SHELL_THEME_IDS) {
    for (const appearanceMode of SHELL_APPEARANCE_MODES) {
      const block = appearanceBlock(themeId, appearanceMode);
      expect(block).not.toBe("");
      expect(block).toContain(`color-scheme: ${appearanceMode};`);
      for (const token of THEME_PALETTE_TOKENS) expect(block).toContain(token);
    }
  }
});

test("switching only appearance preserves stable theme and wallpaper identity", () => {
  const dark = validateShellPreferences({
    ...validPreference("dark"),
    themeId: "plasmon-rosewood",
    wallpaper: { mode: "pinned", id: "glacier-prism" },
  });
  expect(dark).not.toBeNull();
  const light = validateShellPreferences({ ...dark, appearanceMode: "light" });
  expect(light?.themeId).toBe("plasmon-rosewood");
  expect(light?.appearanceMode).toBe("light");
  expect(light?.wallpaper).toEqual({ mode: "pinned", id: "glacier-prism" });
  expect(SHELL_THEME_IDS).toHaveLength(6);
});

test("theme identities remain visually distinct in both appearances", () => {
  for (const appearanceMode of SHELL_APPEARANCE_MODES) {
    for (const token of [
      "--plasmon-desktop-background:",
      "--plasmon-window-background:",
      "--plasmon-window-titlebar:",
      "--plasmon-accent:",
      "--plasmon-text-primary:",
    ]) {
      const values = SHELL_THEME_IDS.map((themeId) => tokenValue(appearanceBlock(themeId, appearanceMode), token));
      expect(values.every(Boolean)).toBe(true);
      expect(new Set(values).size).toBe(6);
    }
  }
});

test("shared disabled, danger, selection, and scrollbar semantics are explicit and readable", () => {
  expect(visualStyles).toContain("var(--plasmon-control-disabled-background)");
  expect(visualStyles).toContain("var(--plasmon-control-disabled-border)");
  expect(visualStyles).toContain(":is(button, input, select, textarea):disabled");
  expect(visualStyles).toContain("opacity: .58;");
  expect(visualStyles).toContain("scrollbar-color: var(--plasmon-scrollbar-thumb) var(--plasmon-scrollbar-track)");
  expect(visualStyles).toContain("var(--plasmon-scrollbar-thumb-hover)");

  for (const themeId of SHELL_THEME_IDS) {
    for (const appearanceMode of SHELL_APPEARANCE_MODES) {
      const danger = tokenValue(appearanceBlock(themeId, appearanceMode), "--plasmon-danger:");
      const [red, green, blue] = rgb(danger);
      expect(red).toBeGreaterThan(green * 1.35);
      expect(red).toBeGreaterThan(blue * 1.25);
    }
    const light = appearanceBlock(themeId, "light");
    expect(contrast(
      tokenValue(light, "--plasmon-selection:"),
      tokenValue(light, "--plasmon-selection-text:"),
    )).toBeGreaterThanOrEqual(4.5);
  }

  const glacierLight = appearanceBlock("plasmon-glacier", "light");
  expect(contrast(
    tokenValue(glacierLight, "--plasmon-scrollbar-track:"),
    tokenValue(glacierLight, "--plasmon-scrollbar-thumb:"),
  )).toBeGreaterThanOrEqual(2);

  expect(windowingStyles).toContain("background: var(--plasmon-danger);");
});

test("normal Desktop label treatment remains while selected Light labels use selection semantics", () => {
  expect(adaptiveStyles).toContain(".fm-entry--desktop:not(.is-renaming) .fm-entry__name");
  expect(adaptiveStyles).toContain("var(--plasmon-wallpaper-label-ink)");
  expect(adaptiveStyles).toContain("var(--plasmon-wallpaper-label-shadow)");
  expect(adaptiveStyles).toContain('[data-plasmon-appearance="light"] .fm-entry--desktop.is-selected:not(.is-renaming) .fm-entry__name');
  expect(adaptiveStyles).toContain("color: var(--plasmon-selection-text);");
  expect(adaptiveStyles).toContain("text-shadow: none;");
});

test("FileManager remains a consumer of shared semantics rather than gaining a competing theme model", () => {
  for (const token of [
    "var(--plasmon-desktop-background)",
    "var(--plasmon-window-background)",
    "var(--plasmon-panel-background)",
    "var(--plasmon-control-background)",
    "var(--plasmon-control-hover)",
    "var(--plasmon-text-primary)",
    "var(--plasmon-selection)",
    "var(--plasmon-selection-border)",
    "var(--plasmon-focus-ring)",
    "var(--plasmon-danger)",
  ]) expect(fileManagerStyles).toContain(token);

  expect(fileManagerStyles).not.toContain("data-plasmon-appearance");
  expect(fileManagerStyles).not.toContain("data-plasmon-theme");
});
