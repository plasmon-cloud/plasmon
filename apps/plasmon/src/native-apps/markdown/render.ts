import DOMPurify, { type Config } from "dompurify";
import { marked } from "marked";
export interface MarkdownSanitizer { sanitize(dirty: string, config?: Config): string | TrustedHTML; }
export const MARKDOWN_URI_PATTERN = /^(?:(?:https?|mailto):|(?:\/(?!\/)|\.\.?\/|#)|(?:[^:/?#\s]+(?:[/?#]|$)))/iu;
export const MARKDOWN_SANITIZE_CONFIG: Config = Object.freeze({ USE_PROFILES: { html: true }, FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "base"], FORBID_ATTR: ["style", "srcdoc"], ALLOWED_URI_REGEXP: MARKDOWN_URI_PATTERN, ALLOW_UNKNOWN_PROTOCOLS: false });
export function parseMarkdownHtml(source: string): string { return marked.parse(source, { async: false, gfm: true }) as string; }
export function sanitizeMarkdownHtml(html: string, sanitizer: MarkdownSanitizer = DOMPurify): string { return String(sanitizer.sanitize(html, MARKDOWN_SANITIZE_CONFIG)); }
export function renderSafeMarkdown(source: string, sanitizer: MarkdownSanitizer = DOMPurify): string { return sanitizeMarkdownHtml(parseMarkdownHtml(source), sanitizer); }
export function isSafeMarkdownHref(href: string): boolean { const value = href.trim(); return value !== "" && MARKDOWN_URI_PATTERN.test(value); }
