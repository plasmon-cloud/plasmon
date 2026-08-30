import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SOURCE_ROOT = resolve(import.meta.dir, "../src");
const DIRECT_CONSOLE_CALL = /\bconsole\.(?:debug|info|log|warn|error)\s*\(/g;

/**
 * Permanent direct-console exceptions are limited to places where the canonical
 * diagnostic service cannot safely exist yet or cannot safely report itself.
 */
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

/**
 * Existing direct-console calls discovered when the canonical producer guard
 * was introduced. These are migration debt, not approved exceptions. The
 * owning subsystem instrumentation work must replace/remove these entries.
 * Keeping exact fingerprints here makes the inventory shrink-only: new calls
 * fail immediately and a migrated call makes its baseline entry stale.
 */
const LEGACY_DIRECT_CONSOLE: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "os/neutron/mock.ts",
    ['console.info(message)'],
  ],
  [
    "os/neutron/frontend-call-admission.ts",
    [
      'console.debug("[plasmon.neutron] queued frontend tool call", {',
      'console.debug("[plasmon.neutron] admitted queued frontend tool call", {',
      'console.debug("[plasmon.neutron] completed queued frontend tool call", {',
    ],
  ],
  [
    "os/fs/background.ts",
    [
      'console.warn("Plasmon filesystem storage fallback:", error.message)',
      'console.warn("Plasmon filesystem invalidation publication failed:", error)',
      'console.warn("Plasmon filesystem revision exceeds Neutron app-state integer range")',
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

function findFingerprint(
  inventory: ReadonlyMap<string, readonly string[]>,
  relativePath: string,
  line: string,
): string | undefined {
  return (inventory.get(relativePath) ?? []).find((candidate) => line.includes(candidate));
}

describe("production diagnostic console policy", () => {
  test("direct production console calls are either unavoidable exceptions or frozen legacy migration debt", () => {
    const violations: string[] = [];
    const seenAllowed = new Set<string>();
    const seenLegacy = new Set<string>();

    for (const file of productionSourceFiles(SOURCE_ROOT)) {
      const relativePath = relative(SOURCE_ROOT, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      DIRECT_CONSOLE_CALL.lastIndex = 0;
      for (let match = DIRECT_CONSOLE_CALL.exec(source); match; match = DIRECT_CONSOLE_CALL.exec(source)) {
        const { lineNumber, line } = sourceLineAt(source, match.index);
        const allowed = findFingerprint(ALLOWED_DIRECT_CONSOLE, relativePath, line);
        if (allowed) {
          seenAllowed.add(`${relativePath}:${allowed}`);
          continue;
        }
        const legacy = findFingerprint(LEGACY_DIRECT_CONSOLE, relativePath, line);
        if (legacy) {
          seenLegacy.add(`${relativePath}:${legacy}`);
          continue;
        }
        violations.push(`${relativePath}:${lineNumber}: unowned direct console call: ${line}`);
      }
    }

    for (const [relativePath, fingerprints] of ALLOWED_DIRECT_CONSOLE) {
      for (const fingerprint of fingerprints) {
        if (!seenAllowed.has(`${relativePath}:${fingerprint}`)) {
          violations.push(`${relativePath}: stale direct-console exception: ${fingerprint}`);
        }
      }
    }

    for (const [relativePath, fingerprints] of LEGACY_DIRECT_CONSOLE) {
      for (const fingerprint of fingerprints) {
        if (!seenLegacy.has(`${relativePath}:${fingerprint}`)) {
          violations.push(`${relativePath}: stale legacy console baseline; remove it: ${fingerprint}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
