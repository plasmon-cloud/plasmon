// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { plasmonMonacoThemeData, type MonacoThemeStyleReader } from "./monacoTheme.ts";

function style(values: Record<string, string>, colorScheme = "dark"): MonacoThemeStyleReader {
  return {
    colorScheme,
    getPropertyValue(name) { return values[name] ?? ""; },
  };
}

test("Monaco projects active shared Visual colors instead of a fixed vs-dark canvas", () => {
  const theme = plasmonMonacoThemeData(style({
    "--plasmon-window-background": "#f6fafc",
    "--plasmon-panel-elevated": "#ffffff",
    "--plasmon-text-primary": "#102a35",
    "--plasmon-text-secondary": "#405e6b",
    "--plasmon-text-subtle": "#607b86",
    "--plasmon-accent": "#087ea4",
    "--plasmon-accent-hover": "#056985",
    "--plasmon-danger": "#b3263e",
    "--plasmon-warning": "#855b00",
    "--plasmon-success": "#137a57",
    "--plasmon-focus-ring": "#006e94",
  }, "light"));

  expect(theme.base).toBe("vs");
  expect(theme.colors["editor.background"]).toBe("#f6fafc");
  expect(theme.colors["editor.foreground"]).toBe("#102a35");
  expect(theme.colors["editorCursor.foreground"]).toBe("#087ea4");
  expect(theme.colors["editor.selectionBackground"]).toBe("#087ea433");
  expect(theme.rules).toContainEqual({ token: "keyword", foreground: "087ea4" });
});

test("Monaco theme projection fails safely to the Plasmon Dark palette", () => {
  const theme = plasmonMonacoThemeData(style({
    "--plasmon-window-background": "not-a-color",
  }));
  expect(theme.base).toBe("vs-dark");
  expect(theme.colors["editor.background"]).toBe("#111820");
  expect(theme.colors["editor.foreground"]).toBe("#f5faf7");
});

test("Monaco host reprojects the theme when the Shell theme attribute changes", () => {
  const host = readFileSync(new URL("./MonacoEditorHost.tsx", import.meta.url), "utf8");
  expect(host).toContain("plasmonMonacoThemeData(getComputedStyle(container))");
  expect(host).toContain('container.closest("[data-plasmon-theme]")');
  expect(host).toContain('attributeFilter: ["data-plasmon-theme"]');
  expect(host).not.toContain('theme: "vs-dark"');
  expect(host).not.toContain('background: "#1e1e1e"');
});
