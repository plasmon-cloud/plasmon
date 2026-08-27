import DOMPurify, { type Config } from "dompurify";
import { marked } from "marked";

export interface MarkdownSanitizer {
  sanitize(dirty: string, config?: Config): string | TrustedHTML;
}

export const MARKDOWN_URI_PATTERN = /^(?:(?:https?|mailto):|(?:\/(?!\/)|\.\.?\/|#)|(?:[^:/?#\s]+(?:[/?#]|$)))/iu;
export const MARKDOWN_SANITIZE_CONFIG: Config = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "base"],
  FORBID_ATTR: ["style", "srcdoc"],
  ALLOWED_URI_REGEXP: MARKDOWN_URI_PATTERN,
  ALLOW_UNKNOWN_PROTOCOLS: false,
});

type MarkdownFence = {
  marker: "`" | "~";
  length: number;
};

function openingFence(line: string): MarkdownFence | null {
  const match = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
  if (!match) return null;
  const run = match[1]!;
  return { marker: run[0] as MarkdownFence["marker"], length: run.length };
}

function closesFence(line: string, fence: MarkdownFence): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[\t ]*\r?$/u.exec(line);
  if (!match) return false;
  const run = match[1]!;
  return run[0] === fence.marker && run.length >= fence.length;
}

/**
 * Build parser input for the one accepted Markdown compatibility rule without
 * rewriting editor/persisted source. Only a single `#` at column zero is
 * normalized, and never while inside fenced code. Indented code and inline
 * `#tag` text are therefore left untouched.
 */
export function prepareMarkdownSourceForParsing(source: string): string {
  let fence: MarkdownFence | null = null;
  return source
    .split("\n")
    .map((line) => {
      if (fence) {
        if (closesFence(line, fence)) fence = null;
        return line;
      }

      const opened = openingFence(line);
      if (opened) {
        fence = opened;
        return line;
      }

      const compactHeading = /^#([^\s#].*)$/u.exec(line);
      return compactHeading ? `# ${compactHeading[1]}` : line;
    })
    .join("\n");
}

export function parseMarkdownHtml(source: string): string {
  return marked.parse(prepareMarkdownSourceForParsing(source), { async: false, gfm: true }) as string;
}

export function sanitizeMarkdownHtml(
  html: string,
  sanitizer: MarkdownSanitizer = DOMPurify,
): string {
  return String(sanitizer.sanitize(html, MARKDOWN_SANITIZE_CONFIG));
}

export function renderSafeMarkdown(
  source: string,
  sanitizer: MarkdownSanitizer = DOMPurify,
): string {
  return sanitizeMarkdownHtml(parseMarkdownHtml(source), sanitizer);
}

export function isSafeMarkdownHref(href: string): boolean {
  const value = href.trim();
  return value !== "" && MARKDOWN_URI_PATTERN.test(value);
}
