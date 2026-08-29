import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const guardPath = "test/ci/verify-active-provenance.mjs";

const activeInputs = Object.freeze([
  "apps/plasmon/src",
  "apps/plasmon/test",
  "test",
  ".github/workflows",
  "package.json",
  "apps/plasmon/package.json",
]);

const explicitHistoricalFiles = new Set([
  "apps/plasmon/test/LUNA_POST_REFACTOR_RECONCILIATION.md",
]);

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".sh", ".yml", ".yaml", ".md", ".txt", ".svg",
]);

const pathRules = Object.freeze([
  ["Issue-numbered active path", /(?:^|[/_.-])issue[-_]?\d+(?:[/_.-]|$)/iu],
  ["PR-numbered active path", /(?:^|[/_.-])pr[-_]?\d+(?:[/_.-]|$)/iu],
  ["numbered Plasmon browser spec", /(?:^|\/)plasmon-[^/]*-\d+\.spec\.[cm]?[jt]sx?$/iu],
  ["release-era test path", /(?:^|[/_.-])r\d+(?:[/_.-]|$)/iu],
  ["camelCase work-item test suffix", /(?:^|\/)[a-z]+(?:[A-Z][A-Za-z]*)+[0-9]{2,}\.(?:test|spec)\.[cm]?[jt]sx?$/u],
]);

const contentRules = Object.freeze([
  ["Issue tag", /@issue-\d+\b/iu],
  ["PR tag", /@pr-\d+\b/iu],
  ["release-numbered tag", /@r\d+(?:[-_][a-z0-9_-]+)?\b/iu],
  ["Issue-numbered test title", /\b(?:test|it|describe)(?:\.(?:only|skip|todo))?\s*\(\s*["'`]#\d+\b/iu],
  ["Issue-numbered active artifact/resource", /\bissue[-_ ]\d+\b/iu],
  ["PR-numbered active artifact/resource", /\bpr[-_ ]\d+\b/iu],
  ["Issue prose reference", /\bissue\s*#?\d+\b/iu],
  ["PR prose reference", /\bpull request\s*#?\d+\b|\bPR\s*#?\d+\b/iu],
  ["concrete release branch coupling", /\brelease\/\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?\b/u],
  ["release-era identifier", /\bR\d+_[A-Z][A-Z0-9_]*\b/u],
  ["submission-fix provenance", /\bsubmission\s+fix\b/iu],
]);

function slash(path) {
  return path.replaceAll("\\", "/");
}

function walkInput(input) {
  const absolute = resolve(repoRoot, input);
  const stat = statSync(absolute);
  if (stat.isFile()) return [slash(relative(repoRoot, absolute))];

  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = resolve(absolute, entry.name);
    if (entry.isDirectory()) files.push(...walkInput(slash(relative(repoRoot, path))));
    else if (entry.isFile()) files.push(slash(relative(repoRoot, path)));
  }
  return files;
}

function isHistorical(path) {
  return path.startsWith("docs/history/")
    || path.includes("/docs/history/")
    || explicitHistoricalFiles.has(path);
}

function isText(path) {
  return textExtensions.has(extname(path).toLowerCase());
}

function isTestOrCiPath(path) {
  return path.startsWith("test/")
    || path.startsWith(".github/workflows/")
    || path.startsWith("apps/plasmon/test/")
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)
    || path.endsWith("package.json");
}

function isCommentLike(path, line) {
  if (path.endsWith(".md")) return true;
  return /^\s*(?:\/\/|\/\*|\*|#)/u.test(line);
}

function allowedLine(path, line) {
  // Current executable debt ownership stays machine-readable while selectors stay semantic.
  if (path === "test/ci/plasmon-quarantine.json" && /"repairIssue"\s*:\s*\d+/u.test(line)) {
    return true;
  }
  // This test deliberately verifies migration from retired work-item-named docs into docs/history.
  if (
    path === "apps/plasmon/test/documentationBoundaries.test.ts"
    && line.includes("apps/plasmon/docs/refactor/issue-")
    && line.includes("apps/plasmon/docs/history/refactor-issue-")
  ) {
    return true;
  }
  return false;
}

function lineFailures(path, line) {
  if (allowedLine(path, line)) return [];
  const failures = [];
  for (const [label, rule] of contentRules) {
    if (rule.test(line)) failures.push(label);
  }
  if (isCommentLike(path, line)) {
    if (/#\d{2,}\b/u.test(line)) failures.push("work-item number in active comment/documentation");
    if (/\b(?:for\s+)?r[23]\b/iu.test(line)) failures.push("release-era wording in active comment/documentation");
  }
  return failures;
}

export function scanActiveProvenance() {
  const failures = [];
  const files = [...new Set(activeInputs.flatMap(walkInput))]
    .filter((path) => path !== guardPath && !isHistorical(path))
    .sort((a, b) => a.localeCompare(b));

  for (const path of files) {
    if (isTestOrCiPath(path)) {
      for (const [label, rule] of pathRules) {
        if (rule.test(path)) failures.push(`${label}: ${path}`);
      }
    }
    if (!isText(path)) continue;

    const lines = readFileSync(resolve(repoRoot, path), "utf8").split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const label of lineFailures(path, line)) {
        failures.push(`${label}: ${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return failures;
}

function selfTest() {
  const issuePath = `issue-${"999"}-foo.test.ts`;
  const numberedSpec = `test/e2e/plasmon-foo-${"999"}.spec.ts`;
  const camelCaseTest = `startMenuReconciliation${"999"}.test.ts`;
  const issueTag = `@issue-${"999"}`;
  const releaseTag = `@r${"9"}-quarantine`;
  const releaseBranch = ["release", "0.1.0-r9"].join("/");
  const testTitle = `test("#${"999"} behavior", () => {})`;
  const artifact = `issue-${"999"}-graphite.png`;

  const blockedPaths = [
    [issuePath, pathRules[0][1]],
    [numberedSpec, pathRules[2][1]],
    [camelCaseTest, pathRules[4][1]],
  ];
  for (const [sample, rule] of blockedPaths) {
    if (!rule.test(sample)) throw new Error(`guard self-test failed to reject path: ${sample}`);
  }

  const blockedContent = [issueTag, releaseTag, releaseBranch, testTitle, artifact];
  for (const sample of blockedContent) {
    if (!contentRules.some(([, rule]) => rule.test(sample))) {
      throw new Error(`guard self-test failed to reject content: ${sample}`);
    }
  }

  const allowed = [
    "schemaVersion: 1",
    "HTTP 404",
    "1920x1080",
    "version 0.1.0",
    "protocolVersion: 2",
    "migrationVersion: 17",
    "sha256.test.ts",
    "release/**",
  ];
  for (const sample of allowed) {
    if (contentRules.some(([, rule]) => rule.test(sample))) {
      throw new Error(`guard self-test incorrectly rejected semantic value: ${sample}`);
    }
  }
  if (pathRules.some(([, rule]) => rule.test("sha256.test.ts"))) {
    throw new Error("guard self-test incorrectly rejected semantic numbered test identity sha256.test.ts");
  }
  if (!allowedLine("test/ci/plasmon-quarantine.json", '      "repairIssue": 304,')) {
    throw new Error("guard self-test lost the bounded quarantine repair-owner allowance");
  }
  if (!allowedLine(
    "apps/plasmon/test/documentationBoundaries.test.ts",
    '["apps/plasmon/docs/refactor/issue-191-red-packet.md", "apps/plasmon/docs/history/refactor-issue-191-red-packet.md"],',
  )) {
    throw new Error("guard self-test lost the bounded historical-document migration allowance");
  }
  if (!isHistorical("apps/plasmon/test/LUNA_POST_REFACTOR_RECONCILIATION.md")) {
    throw new Error("guard self-test lost the explicit historical reconciliation boundary");
  }

  console.log("Active provenance guard self-test passed");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const failures = scanActiveProvenance();
  if (failures.length > 0) {
    console.error(`Active provenance guard found ${failures.length} stale provenance occurrence(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("Active provenance guard passed with no migration baseline");
  }
}
