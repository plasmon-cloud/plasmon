import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const e2eRoot = resolve(repoRoot, "test/e2e");
const reviewedDemoSpecs = new Set([
  "plasmon-demo-content.spec.ts",
  "plasmon-demo-game.spec.ts",
]);

function walk(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walk(path));
    else if (entry.isFile() && /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(entry.name)) paths.push(path);
  }
  return paths;
}

function failuresFor(path) {
  const source = readFileSync(path, "utf8");
  const failures = [];
  if (/\bwaitForTimeout\s*\(/u.test(source)) {
    failures.push("direct Playwright waitForTimeout calls are not permitted");
  }
  if (reviewedDemoSpecs.has(path.split("/").pop())) {
    if (/timeout\s*:\s*(?:20|30|60)_000\b/u.test(source)) {
      failures.push("reviewed demo acceptance must not use unexplained long assertion bounds");
    }
  }
  if (path.endsWith("/plasmon-demo-game.spec.ts")) {
    if (!/const JS_DOS_EXTERNAL_STARTUP_TIMEOUT_MS = 60_000;/u.test(source)) {
      failures.push("js-dos external startup SLA must be named and isolated");
    }
    if (!/data-jsdos-(?:ready|progress-restored).*JS_DOS_EXTERNAL_STARTUP_TIMEOUT_MS/u.test(source)) {
      failures.push("js-dos SLA must guard production-owned readiness signals");
    }
  }
  return failures;
}

const failures = [];
for (const path of walk(e2eRoot)) {
  for (const failure of failuresFor(path)) {
    failures.push(`${path.slice(repoRoot.length + 1)}: ${failure}`);
  }
}

if (failures.length > 0) {
  console.error(`Playwright timing guard found ${failures.length} violation(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Playwright timing guard passed (${walk(e2eRoot).length} specs scanned)`);
}
