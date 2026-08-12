import type { ReviewAtomState, ReviewItem, SourceImport } from "./model.ts";

export interface ParsedReviewMarkdown {
  title: string | null;
  items: Array<{ title: string; descriptionMarkdown?: string }>;
}

export function parseReviewMarkdown(markdown: string): ParsedReviewMarkdown {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  let title: string | null = null;
  const items: Array<{ title: string; descriptionMarkdown?: string }> = [];
  for (const line of lines) {
    const heading = /^#\s+(.+?)\s*$/u.exec(line);
    if (!title && heading?.[1]) title = heading[1].trim();
    // Only top-level list entries are Review items. Indented bullets are
    // portable metadata/notes and must not become extra items on re-import.
    const todo = /^[-*+]\s+\[[ xX]\]\s+(.+?)\s*$/u.exec(line);
    const bullet = /^[-*+]\s+(?!\[[ xX]\]\s)(.+?)\s*$/u.exec(line);
    const value = todo?.[1] ?? bullet?.[1];
    if (value?.trim()) items.push({ title: value.trim() });
  }
  return { title, items };
}

export function sourceImport(path: string, mediaType: string, importedAt: number, etag?: string): SourceImport {
  return {
    path,
    mediaType,
    ...(etag ? { etag } : {}),
    importedAt,
  };
}

export function exportReviewMarkdown(state: ReviewAtomState): string {
  const lines: string[] = [`# ${state.meta.title}`, ""];
  for (const item of state.items) {
    lines.push(`- [ ] ${item.title}`);
    lines.push(`  - Desired: ${display(item.coordination.desired)}`);
    lines.push(`  - Effort: ${display(item.coordination.effort)}`);
    lines.push(`  - Owner: ${item.coordination.owner ?? "unset"}`);
    lines.push(`  - Work state: ${display(item.coordination.workState)}`);
    const counts = resultCounts(item);
    lines.push(`  - Results: ${counts.working} working, ${counts.not_working} not working, ${counts.needs_polish} needs polish, ${counts.not_tested} not tested`);
    if (item.descriptionMarkdown) {
      lines.push("", ...item.descriptionMarkdown.split("\n").map((line) => `    ${line}`));
    }
    const comments = state.comments.filter((comment) => comment.itemId === item.itemId);
    for (const comment of comments) lines.push(`  - Comment (${comment.displayName ?? comment.actor}): ${singleLine(comment.body)}`);
  }
  lines.push("", `<!-- Review Atom ${state.meta.atomId}; revision ${state.meta.currentRevision} -->`, "");
  return lines.join("\n");
}

function resultCounts(item: ReviewItem): Record<"working" | "not_working" | "needs_polish" | "not_tested", number> {
  const counts = { working: 0, not_working: 0, needs_polish: 0, not_tested: 0 };
  for (const result of Object.values(item.results)) counts[result.result] += 1;
  return counts;
}

function display(value: string | null): string {
  return value === null ? "unset" : value.replaceAll("_", " ");
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
