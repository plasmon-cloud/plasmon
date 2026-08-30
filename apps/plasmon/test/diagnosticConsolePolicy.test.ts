import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SOURCE_ROOT = resolve(import.meta.dir, "../src");
const DIRECT_CONSOLE_CALL = /\bconsole\.(?:debug|info|log|warn|error)\s*\(/g;

const ALLOWED_DIRECT_CONSOLE: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "os/integration/services.ts",
    [
      // Repository selection happens before DiagnosticService exists. This is a
      // bootstrap-last-resort signal rather than a competing logging authority.
      'console.warn("Plasmon standalone filesystem storage fallback:", error.message)',
      // Diagnostic sink failure cannot safely recurse through DiagnosticService.
      'console.error("Plasmon diagnostic persistence failed:", error)',
    ],
  ],
]);

function productionSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...productionSourceFiles(path));
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) continue;
    files.push(path);
  }
  return files;
}

function sourceLineAt(text: string, offset: number): { lineNumber: number; line: string } {
  const before = text.slice(0, offset);
  const lineNumber = before.split("\n").length;
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = text.indexOf("\n", offset);
  return {
    lineNumber,
    line: text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim(),
  };
}

describe("production diagnostic console policy", () => {
  test("all direct production console calls are explicit bootstrap or sink-failure exceptions", () => {
    const violations: string[] = [];
    const seenAllowed = new Set<string>();

    for (const file of productionSourceFiles(SOURCE_ROOT)) {
      const relativePath = relative(SOURCE_ROOT, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      DIRECT_CONSOLE_CALL.lastIndex = 0;
      for (let match = DIRECT_CONSOLE_CALL.exec(source); match; match = DIRECT_CONSOLE_CALL.exec(source)) {
        const { lineNumber, line } = sourceLineAt(source, match.index);
        const allowedFingerprints = ALLOWED_DIRECT_CONSOLE.get(relativePath) ?? [];
        const fingerprint = allowedFingerprints.find((candidate) => line.includes(candidate));
        if (fingerprint) {
          seenAllowed.add(`${relativePath}:${fingerprint}`);
          continue;
        }
        violations.push(`${relativePath}:${lineNumber}: ${line}`);
      }
    }

    for (const [relativePath, fingerprints] of ALLOWED_DIRECT_CONSOLE) {
      for (const fingerprint of fingerprints) {
        if (!seenAllowed.has(`${relativePath}:${fingerprint}`)) {
          violations.push(`${relativePath}: stale direct-console exception: ${fingerprint}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
