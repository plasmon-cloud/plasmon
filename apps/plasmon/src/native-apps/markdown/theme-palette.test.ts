// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MARKDOWN_PREVIEW_CSS } from "./MarkdownPreview.tsx";

test("#511 Markdown preview consumes the active Visual palette instead of a fixed dark canvas", () => {
  const source = readFileSync(new URL("./MarkdownPreview.tsx", import.meta.url), "utf8");

  expect(source).toContain('background: "var(--plasmon-window-background, Canvas)"');
  expect(source).toContain('color: "var(--plasmon-text-primary, CanvasText)"');
  expect(MARKDOWN_PREVIEW_CSS).toContain("background: var(--plasmon-window-background, Canvas)");
  expect(MARKDOWN_PREVIEW_CSS).toContain("color: var(--plasmon-text-primary, CanvasText)");
  expect(MARKDOWN_PREVIEW_CSS).toContain("border-bottom: 1px solid var(--plasmon-border-subtle, ButtonBorder)");
  expect(MARKDOWN_PREVIEW_CSS).toContain("color: var(--plasmon-accent, LinkText)");
  expect(MARKDOWN_PREVIEW_CSS).toContain("background: var(--plasmon-panel-elevated, Canvas)");
  expect(MARKDOWN_PREVIEW_CSS).toContain("background: var(--plasmon-control-background, Canvas)");

  for (const fixedDark of ["#171a1f", "#0f1216", "#2a3039", "#252b33", "#1d2127"]) {
    expect(source).not.toContain(fixedDark);
  }
});
