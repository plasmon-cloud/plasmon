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
  let current: { title: string; description: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const descriptionMarkdown = trimDescription(current.description);
    items.push({
      title: current.title,
      ...(descriptionMarkdown ? { descriptionMarkdown } : {}),
    });
    current = null;
  };

  for (const line of lines) {
    const heading = /^#\s+(.+?)\s*$/u.exec(line);
    if (!title && heading?.[1]) {
      title = heading[1].trim();
      continue;
    }

    const todo = /^[-*+]\s+\[[ xX]\]\s+(.+?)\s*$/u.exec(line);
    const bullet = /^[-*+]\s+(?!\[[ xX]\]\s)(.+?)\s*$/u.exec(line);
    const topLevelItem = todo?.[1] ?? bullet?.[1];
    if (topLevelItem?.trim()) {
      flush();
      current = { title: topLevelItem.trim(), description: [] };
      continue;
    }

    if (current) {
      const indented = /^(?: {2,}|\t)(.*)$/u.exec(line);
      if (indented) {
        current.description.push(indented[1] ?? "");
        continue;
      }
      if (!line.trim()) current.description.push("");
    }
  }

  flush();
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
  const lines: string[] = [
    `# ${state.meta.title}`,
    "",
    `Review Atom: ${state.meta.atomId}`,
    `Revision: ${state.meta.currentRevision}`,
    `Generated: ${new Date(state.meta.updatedAt).toISOString()}`,
    "",
    "This is a submitted human-acceptance snapshot. Reviewers performed these checks in the real OS; downstream AI or engineering triage should treat the recorded observations as evidence, not as work already completed.",
    "",
  ];

  for (const item of state.items) {
    const aggregate = aggregateResult(item);
    lines.push(`- [${aggregate === "pass" ? "x" : " "}] ${item.title}`);
    if (item.descriptionMarkdown) {
      lines.push("  How to test / expected behavior:");
      for (const line of item.descriptionMarkdown.split("\n")) lines.push(`    ${line}`);
    }

    const participantResults = Object.values(item.results)
      .filter((result) => result.result !== "not_tested")
      .sort((a, b) => a.actor.localeCompare(b.actor));

    if (!participantResults.length) {
      lines.push("  Review status: not reviewed");
    } else {
      lines.push(`  Review status: ${aggregate}`);
      lines.push("  Human observations:");
      for (const result of participantResults) {
        lines.push(`    - ${result.actor}: ${resultLabel(result.result)}`);
        if (result.note) lines.push(`      Observation: ${singleLine(result.note)}`);
        lines.push(`      Recorded: ${new Date(result.updatedAt).toISOString()}`);
      }
    }

    const comments = state.comments.filter((comment) => comment.itemId === item.itemId);
    if (comments.length) {
      lines.push("  Reviewer discussion:");
      for (const comment of comments) {
        lines.push(`    - ${comment.displayName ?? comment.actor}: ${singleLine(comment.body)}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function trimDescription(lines: string[]): string | undefined {
  const next = [...lines];
  while (next.length && !next[0]?.trim()) next.shift();
  while (next.length && !next[next.length - 1]?.trim()) next.pop();
  if (!next.length) return undefined;
  return next.join("\n");
}

function aggregateResult(item: ReviewItem): "pass" | "fail" | "mixed" | "not reviewed" {
  const reviewed = Object.values(item.results).filter((entry) => entry.result !== "not_tested");
  if (!reviewed.length) return "not reviewed";
  const hasPass = reviewed.some((entry) => entry.result === "working");
  const hasFailure = reviewed.some((entry) => entry.result === "not_working" || entry.result === "needs_polish");
  if (hasPass && hasFailure) return "mixed";
  return hasFailure ? "fail" : "pass";
}

function resultLabel(result: ReviewItem["results"][string]["result"]): string {
  if (result === "working") return "PASS";
  if (result === "not_working") return "FAIL";
  if (result === "needs_polish") return "FAIL / needs follow-up";
  return "NOT REVIEWED";
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
