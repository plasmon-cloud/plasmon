import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(testDirectory, "../src");
const productionExtension = /\.[cm]?[jt]sx?$/;
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const directConsole = /\bconsole\.(?:debug|info|log|warn|error)\s*\(/;

const fullyExemptFiles = new Set([
  // Canonical console sink implementation. Product producers must not use this exemption.
  "os/diagnostics/service.ts",
]);

const exactBootstrapExceptions = new Map<string, readonly string[]>([
  [
    "os/integration/services.ts",
    [
      'console.warn("Plasmon standalone filesystem storage fallback:"',
      'console.error("Plasmon diagnostic persistence failed:"',
    ],
  ],
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

function slash(path: string): string {
  return path.replaceAll("\\", "/");
}

describe("production diagnostics console guard", () => {
  test("keeps direct production console calls behind the canonical diagnostics boundary", async () => {
    const violations: string[] = [];
    for (const path of await walk(sourceRoot)) {
      if (!productionExtension.test(path) || testFile.test(path)) continue;
      const sourcePath = slash(relative(sourceRoot, path));
      if (fullyExemptFiles.has(sourcePath)) continue;

      const exceptions = exactBootstrapExceptions.get(sourcePath) ?? [];
      const lines = (await readFile(path, "utf8")).split("\n");
      lines.forEach((line, index) => {
        if (!directConsole.test(line)) return;
        if (exceptions.some((exception) => line.includes(exception))) return;
        violations.push(`${sourcePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(
      violations,
      `Direct production console calls must use DiagnosticService.for(...), or be a documented bootstrap/sink exception:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
