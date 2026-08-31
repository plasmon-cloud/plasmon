import { reportMarkdownFormatFailure } from "../semanticDiagnostics.ts";

export type MarkdownFormatter = (source: string) => string;

export interface MarkdownFormatAttempt {
  text: string;
  changed: boolean;
  error: string | null;
}

interface FenceState {
  marker: "`" | "~";
  length: number;
}

function openingFence(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})/u);
  if (!match) return null;
  const token = match[1]!;
  return { marker: token[0] as "`" | "~", length: token.length };
}

function closesFence(line: string, fence: FenceState): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed[0] !== fence.marker) return false;
  const markerLength = [...trimmed].findIndex((character) => character !== fence.marker);
  const runLength = markerLength === -1 ? trimmed.length : markerLength;
  return runLength >= fence.length && trimmed.slice(runLength).trim() === "";
}

/**
 * Conservative Markdown source formatter.
 *
 * It normalizes line endings, blank-only lines, excessive blank-line runs, and
 * terminal newlines outside fenced code. Nonblank trailing whitespace is kept
 * intact because Markdown uses two trailing spaces as an explicit hard break.
 * Fenced code content is copied byte-for-byte after line-ending normalization.
 */
export function formatMarkdown(source: string): string {
  if (!source) return "";

  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  const formatted: string[] = [];
  let fence: FenceState | null = null;
  let blankRun = 0;

  for (const line of lines) {
    if (fence) {
      formatted.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    const nextFence = openingFence(line);
    if (nextFence) {
      fence = nextFence;
      blankRun = 0;
      formatted.push(line);
      continue;
    }

    if (/^\s*$/u.test(line)) {
      blankRun += 1;
      if (blankRun <= 2) formatted.push("");
      continue;
    }

    blankRun = 0;
    formatted.push(line);
  }

  if (fence) return formatted.join("\n");
  while (formatted.at(-1) === "") formatted.pop();
  return formatted.length ? `${formatted.join("\n")}\n` : "";
}

export function applyMarkdownFormatter(
  source: string,
  formatter: MarkdownFormatter | null = formatMarkdown,
): MarkdownFormatAttempt {
  if (!formatter) {
    return { text: source, changed: false, error: "No Markdown formatter is available." };
  }

  try {
    const text = formatter(source);
    return { text, changed: text !== source, error: null };
  } catch (error) {
    reportMarkdownFormatFailure();
    const detail = error instanceof Error ? error.message : String(error);
    return { text: source, changed: false, error: `Markdown formatting failed: ${detail}` };
  }
}
