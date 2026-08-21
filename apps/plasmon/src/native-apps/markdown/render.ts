import DOMPurify, { type Config } from "dompurify";
import { marked } from "marked";
export interface MarkdownSanitizer { sanitize(dirty: string, config?: Config): string | TrustedHTML; }
interface MarkdownPreviewFence { marker: "`" | "~"; length: number; }
export const MARKDOWN_URI_PATTERN = /^(?:(?:https?|mailto):|(?:\/(?!\/)|\.\.?\/|#)|(?:[^:/?#\s]+(?:[/?#]|$)))/iu;
export const MARKDOWN_SANITIZE_CONFIG: Config = Object.freeze({ USE_PROFILES: { html: true }, FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "base"], FORBID_ATTR: ["style", "srcdoc"], ALLOWED_URI_REGEXP: MARKDOWN_URI_PATTERN, ALLOW_UNKNOWN_PROTOCOLS: false });
function openingPreviewFence(line: string): MarkdownPreviewFence | null { const match = line.match(/^ {0,3}(`{3,}|~{3,})/u); if (!match) return null; const token = match[1]!; return { marker: token[0] as "`" | "~", length: token.length }; }
function closesPreviewFence(line: string, fence: MarkdownPreviewFence): boolean { const match = line.match(/^ {0,3}(`+|~+)[\t ]*$/u); if (!match) return false; const token = match[1]!; return token[0] === fence.marker && token.length >= fence.length; }
export function normalizeMarkdownPreviewSource(source: string): string { const lines = source.replace(/\r\n?/gu, "\n").split("\n"); let fence: MarkdownPreviewFence | null = null; return lines.map((line) => { if (fence) { if (closesPreviewFence(line, fence)) fence = null; return line; } const nextFence = openingPreviewFence(line); if (nextFence) { fence = nextFence; return line; } return line.replace(/^( {0,3})(#{1,6})([^#\s].*)$/u, "$1$2 $3"); }).join("\n"); }
export function parseMarkdownHtml(source: string): string { return marked.parse(normalizeMarkdownPreviewSource(source), { async: false, gfm: true }) as string; }
export function sanitizeMarkdownHtml(html: string, sanitizer: MarkdownSanitizer = DOMPurify): string { return String(sanitizer.sanitize(html, MARKDOWN_SANITIZE_CONFIG)); }
export function renderSafeMarkdown(source: string, sanitizer: MarkdownSanitizer = DOMPurify): string { return sanitizeMarkdownHtml(parseMarkdownHtml(source), sanitizer); }
export function isSafeMarkdownHref(href: string): boolean { const value = href.trim(); return value !== "" && MARKDOWN_URI_PATTERN.test(value); }
