// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const shellCss = readFileSync(new URL("./shell.scss", import.meta.url), "utf8");
const visualTokens = readFileSync(new URL("../integration/visual-tokens.scss", import.meta.url), "utf8");

test("#111 Shell consumes shared Visual semantics instead of owning a parallel token palette", () => {
  for (const retiredDeclaration of [
    "--plasmon-bg:",
    "--plasmon-bg-elevated:",
    "--plasmon-bg-glass:",
    "--plasmon-surface-hover:",
    "--plasmon-border:",
    "--plasmon-text-muted:",
    "--plasmon-accent-strong:",
    "--plasmon-focus:",
    "--plasmon-shadow:",
    "--plasmon-radius-sm:",
    "--plasmon-radius-md:",
    "--plasmon-radius-lg:",
    "--plasmon-font:",
    "--plasmon-font-xs:",
    "--plasmon-font-sm:",
    "--plasmon-font-md:",
    "--plasmon-font-lg:",
    "--plasmon-font-xl:",
  ]) expect(shellCss).not.toContain(retiredDeclaration);

  for (const sharedToken of [
    "--plasmon-control-background:",
    "--plasmon-control-hover:",
    "--plasmon-text-subtle:",
    "--plasmon-font-size-heading:",
    "--plasmon-font-size-display:",
  ]) expect(visualTokens).toContain(sharedToken);
});

test("#111 assembled Shell surfaces use shared focus, framing, state, typography, and elevation semantics", () => {
  for (const token of [
    "var(--plasmon-taskbar-background)",
    "var(--plasmon-panel-elevated)",
    "var(--plasmon-border-subtle)",
    "var(--plasmon-border-strong)",
    "var(--plasmon-control-background)",
    "var(--plasmon-control-hover)",
    "var(--plasmon-text-primary)",
    "var(--plasmon-text-secondary)",
    "var(--plasmon-text-subtle)",
    "var(--plasmon-accent)",
    "var(--plasmon-accent-ink)",
    "var(--plasmon-focus-ring)",
    "var(--plasmon-shadow-panel)",
    "var(--plasmon-radius-control)",
    "var(--plasmon-radius-panel)",
    "var(--plasmon-font-ui)",
    "var(--plasmon-font-size-ui)",
    "var(--plasmon-taskbar-height)",
  ]) expect(shellCss).toContain(token);

  for (const surface of [
    ".plasmon-shell__taskbar",
    ".plasmon-shell__panel",
    ".plasmon-shell__search-box",
    ".plasmon-shell__calendar-grid",
    ".plasmon-shell__error",
  ]) expect(shellCss).toContain(surface);
});

test("#111 Midnight overrides shared semantic tokens so descendant surfaces inherit one theme", () => {
  const midnight = shellCss.match(/\.plasmon-shell\[data-plasmon-theme="plasmon-midnight"\]\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
  expect(midnight).not.toBe("");

  for (const token of [
    "--plasmon-desktop-background:",
    "--plasmon-panel-background:",
    "--plasmon-panel-elevated:",
    "--plasmon-window-background:",
    "--plasmon-window-titlebar:",
    "--plasmon-taskbar-background:",
    "--plasmon-accent:",
    "--plasmon-selection:",
    "--plasmon-focus-ring:",
  ]) expect(midnight).toContain(token);

  expect(midnight).not.toContain("--plasmon-bg:");
  expect(midnight).not.toContain("--plasmon-bg-glass:");
});
