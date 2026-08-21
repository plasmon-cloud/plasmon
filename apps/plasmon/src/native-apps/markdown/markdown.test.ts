import { expect, test } from "bun:test";
import { markdownPaneVisibility, MARKDOWN_MODES } from "./MarkdownEditor.tsx";
import { MARKDOWN_PREVIEW_CSS } from "./MarkdownPreview.tsx";
import {
  isSafeMarkdownHref,
  MARKDOWN_SANITIZE_CONFIG,
  parseMarkdownHtml,
  renderSafeMarkdown,
  type MarkdownSanitizer,
} from "./render.ts";

test("Marked renders real headings, lists, blockquotes, code, emphasis, and GFM tables", () => {
  const html = parseMarkdownHtml(`# Heading\n\n- one\n- two\n\n> quote\n\n**strong** and *em* and \`inline\`\n\n\`\`\`ts\nconst n = 1;\n\`\`\`\n\n| A | B |\n| - | - |\n| 1 | 2 |`);
  expect(html).toContain("<h1>Heading</h1>");
  expect(html).toContain("<ul>");
  expect(html).toContain("<blockquote>");
  expect(html).toContain("<pre><code");
  expect(html).toContain("<strong>strong</strong>");
  expect(html).toContain("<em>em</em>");
  expect(html).toContain("<table>");
});

test("basic Markdown Preview source produces semantic heading, paragraph, and list output", () => {
  const source = "# Big Heading\n\nNormal paragraph.\n\n- one\n- two";
  const identitySanitizer: MarkdownSanitizer = { sanitize: (value) => value };
  const html = renderSafeMarkdown(source, identitySanitizer);

  expect(html).toContain("<h1>Big Heading</h1>");
  expect(html).toContain("<p>Normal paragraph.</p>");
  expect(html).toContain("<ul>");
  expect(html).toContain("<li>one</li>");
  expect(html).toContain("<li>two</li>");
  expect(html).not.toContain("# Big Heading");
});

test("Markdown Preview presentation preserves heading hierarchy and visible list markers after resets", () => {
  expect(MARKDOWN_PREVIEW_CSS).toMatch(/h1\s*\{\s*font-size:\s*2em;/u);
  expect(MARKDOWN_PREVIEW_CSS).toMatch(/h2\s*\{\s*font-size:\s*1\.5em;/u);
  expect(MARKDOWN_PREVIEW_CSS).toMatch(/h3\s*\{\s*font-size:\s*1\.25em;/u);
  expect(MARKDOWN_PREVIEW_CSS).toContain("font-weight: 700");
  expect(MARKDOWN_PREVIEW_CSS).toContain(".plasmon-markdown-preview p { margin: 0 0 1em; }");
  expect(MARKDOWN_PREVIEW_CSS).toContain("padding-left: 2em");
  expect(MARKDOWN_PREVIEW_CSS).toContain(".plasmon-markdown-preview ul { list-style: disc outside; }");
  expect(MARKDOWN_PREVIEW_CSS).toContain(".plasmon-markdown-preview ol { list-style: decimal outside; }");
  expect(MARKDOWN_PREVIEW_CSS).toContain(".plasmon-markdown-preview li { display: list-item; }");
});

test("Markdown rendering always passes parser output through the sanitizer policy", () => {
  let dirty = "";
  let config = undefined as unknown;
  const sanitizer: MarkdownSanitizer = {
    sanitize(value, options) {
      dirty = value;
      config = options;
      return value.replace(/<script[\s\S]*?<\/script>/giu, "").replace(/ href="javascript:[^"]*"/giu, "");
    },
  };
  const clean = renderSafeMarkdown("<script>alert(1)</script>\n\n[bad](javascript:alert(2))", sanitizer);
  expect(dirty).toContain("<script>");
  expect(clean).not.toContain("<script>");
  expect(clean).not.toContain("javascript:");
  expect(config).toBe(MARKDOWN_SANITIZE_CONFIG);
});

test("unsafe Markdown link schemes are rejected", () => {
  expect(isSafeMarkdownHref("https://example.com")).toBe(true);
  expect(isSafeMarkdownHref("mailto:hello@example.com")).toBe(true);
  expect(isSafeMarkdownHref("#section")).toBe(true);
  expect(isSafeMarkdownHref("guide/page.md")).toBe(true);
  expect(isSafeMarkdownHref("javascript:alert(1)")).toBe(false);
  expect(isSafeMarkdownHref("data:text/html,<script>alert(1)</script>")).toBe(false);
});

test("Edit, Split, and Preview modes expose intended panes", () => {
  expect(MARKDOWN_MODES).toEqual(["edit", "split", "preview"]);
  expect(markdownPaneVisibility("edit")).toEqual({ editor: true, preview: false });
  expect(markdownPaneVisibility("split")).toEqual({ editor: true, preview: true });
  expect(markdownPaneVisibility("preview")).toEqual({ editor: false, preview: true });
});
