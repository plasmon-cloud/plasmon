import { expect, test } from "bun:test";
import {
  MARKDOWN_EDITOR_COMMANDS,
  MARKDOWN_EDITOR_DEFAULTS,
  markdownEditorWindowTitle,
} from "./editorPresentation.ts";
import { applyMarkdownFormatter, formatMarkdown } from "./markdownFormatter.ts";

test("Markdown uses the accepted Monaco Editor window-title identity", () => {
  expect(markdownEditorWindowTitle("Guide.md")).toBe("Guide.md - Monaco Editor");
  expect(markdownEditorWindowTitle("   ")).toBe("Untitled - Monaco Editor");
});

test("Markdown exposes the shared high-value Monaco command vocabulary and editor defaults", () => {
  expect(MARKDOWN_EDITOR_COMMANDS).toEqual([
    { command: "find", label: "Find" },
    { command: "replace", label: "Replace" },
    { command: "goToLine", label: "Go to line" },
  ]);
  expect(MARKDOWN_EDITOR_DEFAULTS).toEqual({ minimap: true, wordWrap: false });
});

test("Markdown formatting is deterministic and preserves hard-break whitespace", () => {
  const source = "# Heading\r\n   \r\n\r\n\r\nParagraph with a hard break  \r\n";
  const formatted = "# Heading\n\n\nParagraph with a hard break  \n";
  expect(formatMarkdown(source)).toBe(formatted);
  expect(formatMarkdown(formatted)).toBe(formatted);
});

test("Markdown formatting preserves fenced-code content while normalizing surrounding whitespace", () => {
  const source = "```txt\nline\n   \n\n\ninside\n```\n\n\n\nAfter\n";
  expect(formatMarkdown(source)).toBe("```txt\nline\n   \n\n\ninside\n```\n\n\nAfter\n");
});

test("unclosed fenced Markdown retains trailing fenced content", () => {
  const source = "```txt\ncontent\n\n\n";
  expect(formatMarkdown(source)).toBe(source);
});

test("formatter failure or absence leaves source content unchanged with useful feedback", () => {
  const source = "# Keep me\n";
  expect(applyMarkdownFormatter(source, null)).toEqual({
    text: source,
    changed: false,
    error: "No Markdown formatter is available.",
  });
  expect(applyMarkdownFormatter(source, () => { throw new Error("provider failed"); })).toEqual({
    text: source,
    changed: false,
    error: "Markdown formatting failed: provider failed",
  });
});
