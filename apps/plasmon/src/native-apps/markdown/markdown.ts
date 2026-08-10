export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string; code: string };

export interface InlinePart {
  type: "text" | "code" | "em" | "strong" | "link";
  text: string;
  href?: string;
}

export function safeMarkdownHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^\s*```([^`]*)$/);
    if (fence) {
      const body: string[] = []; index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? "")) body.push(lines[index++] ?? "");
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: (fence[1] ?? "").trim(), code: body.join("\n") }); continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() }); index += 1; continue; }
    const list = line.match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[2]); const items: string[] = [];
      while (index < lines.length) { const match = (lines[index] ?? "").match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)$/); if (!match || Boolean(match[2]) !== ordered) break; items.push(match[3] ?? ""); index += 1; }
      blocks.push({ type: "list", ordered, items }); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) { const current = lines[index] ?? ""; if (!current.trim() || /^\s*```/.test(current) || /^\s*#{1,6}\s+/.test(current) || /^\s*(?:[-+*]|\d+\.)\s+/.test(current)) break; paragraph.push(current.trim()); index += 1; }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

/** Deliberately small inline parser. It returns data only; raw HTML is never interpreted. */
export function parseInlineMarkdown(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^\s)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0; if (start > cursor) parts.push({ type: "text", text: text.slice(cursor, start) }); const token = match[0];
    if (token.startsWith("`")) parts.push({ type: "code", text: token.slice(1, -1) });
    else if (token.startsWith("**") || token.startsWith("__")) parts.push({ type: "strong", text: token.slice(2, -2) });
    else if (token.startsWith("*") || token.startsWith("_")) parts.push({ type: "em", text: token.slice(1, -1) });
    else { const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!; const href = safeMarkdownHref(link[2] ?? ""); parts.push(href ? { type: "link", text: link[1] ?? "", href } : { type: "text", text: link[1] ?? "" }); }
    cursor = start + token.length;
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
  return parts;
}
