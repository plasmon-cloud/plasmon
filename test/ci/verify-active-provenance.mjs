import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const guardPath = "test/ci/verify-active-provenance.mjs";

const activeInputs = Object.freeze([
  "README.md",
  "AGENTS.md",
  "apps/plasmon/README.md",
  "apps/plasmon/AGENTS.md",
  "apps/plasmon/TESTING.md",
  "apps/plasmon/backend",
  "apps/plasmon/build.ts",
  "apps/plasmon/docs",
  "apps/plasmon/monacoWorkerTransport.ts",
  "apps/plasmon/neutron.json",
  "apps/plasmon/neutron.lock.json",
  "apps/plasmon/public",
  "apps/plasmon/src",
  "apps/plasmon/test",
  "apps/review/AGENTS.md",
  "apps/review/README.md",
  "apps/review/build.ts",
  "apps/review/e2e",
  "apps/review/neutron.json",
  "apps/review/package.json",
  "apps/review/playwright.config.ts",
  "apps/review/src",
  "apps/review/test",
  "test",
  ".github/workflows",
  "package.json",
  "apps/plasmon/package.json",
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
  ["standalone R2/R3 release-era token", /\b[rR][23]\b/u],
  ["work-item number in test title", /\b(?:test|it|describe)(?:\.(?:only|skip|todo))?\s*\(\s*["'`][^"'`\r\n]*#\d{2,}\b/iu],
  ["Issue-numbered active artifact/resource", /\bissue[-_ ]\d+\b/iu],
  ["PR-numbered active artifact/resource", /\bpr[-_ ]\d+\b/iu],
  ["Issue prose reference", /\bissue\s*#?\d+\b/iu],
  ["PR prose reference", /\bpull request\s*#?\d+\b|\bPR\s*#?\d+\b/iu],
  ["work-item number in active Actions diagnostic", /::(?:error|warning|notice)\s+title=[^:\r\n]*#\d{2,}\b/iu],
  ["concrete release branch coupling", /\brelease\/\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?\b/u],
  ["release-era identifier", /\bR\d+_[A-Z][A-Z0-9_]*\b/u],
  ["submission-fix provenance", /\bsubmission\s+fix\b/iu],
]);

const explicitClassifications = Object.freeze([
  Object.freeze({
    id: "provenance-guard-negative-fixtures",
    path: guardPath,
    kind: "scanner-self-test",
    reason: "The guard source deliberately constructs synthetic work-item and release-era specimens so its permanent negative tests can prove those identities are rejected. The file is never a product/test identity and is excluded from its own recursive scan to avoid self-matching.",
  }),
  Object.freeze({
    id: "labeled-flake-probe-retired-scope-fixture",
    path: "test/ci/verify-labeled-flake-probe.mjs",
    kind: "ci-negative-fixture",
    linePattern: /"Check r2 scope"/u,
    reason: "This verifier names a retired release-era workflow step only in its forbidden-fragment list, proving that the current labeled flake-probe workflow cannot regress to the old release-specific scope check.",
  }),
  Object.freeze({
    id: "test-inventory-retired-quarantine-marker-fixture",
    path: "test/ci/verify-plasmon-test-inventory.mjs",
    kind: "ci-negative-fixture",
    linePattern: /legacyQuarantineMarker.*\["r2", "quarantine"\]/u,
    reason: "This verifier reconstructs the retired release-numbered quarantine marker only as a negative fixture so active tests and guidance cannot regress from the semantic @quarantine selector.",
  }),
  Object.freeze({
    id: "quarantine-repair-owner",
    path: "test/ci/plasmon-quarantine.json",
    kind: "current-machine-readable-owner",
    linePattern: /"repairIssue"\s*:\s*\d+/u,
    reason: "The active quarantine entry may retain one bounded GitHub repair owner while the executable selector, test title, tag, and CI behavior remain semantic and release-neutral.",
  }),
]);

function slash(path) {
  return path.replaceAll("\\", "/");
}

function walkInput(input, root = repoRoot) {
  const absolute = resolve(root, input);
  const stat = statSync(absolute);
  if (stat.isFile()) return [slash(relative(root, absolute))];

  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = resolve(absolute, entry.name);
    if (entry.isDirectory()) files.push(...walkInput(slash(relative(root, path)), root));
    else if (entry.isFile()) files.push(slash(relative(root, path)));
  }
  return files;
}

function isText(path) {
  return textExtensions.has(extname(path).toLowerCase());
}

function isActiveCheckedPath(path) {
  return path.startsWith("test/")
    || path.startsWith(".github/workflows/")
    || path.startsWith("apps/plasmon/src/")
    || path.startsWith("apps/plasmon/test/")
    || path.startsWith("apps/review/src/")
    || path.startsWith("apps/review/test/")
    || path.startsWith("apps/review/e2e/")
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)
    || path.endsWith("package.json");
}

function isCommentLike(path, line) {
  if (path.endsWith(".md")) return true;
  return /^\s*(?:\/\/|\/\*|\*|#)/u.test(line);
}

function classificationForLine(path, line) {
  return explicitClassifications.find((entry) => entry.path === path && entry.linePattern?.test(line)) ?? null;
}

function allowedLine(path, line) {
  return classificationForLine(path, line) !== null;
}

function lineFailures(path, line) {
  if (allowedLine(path, line)) return [];
  const failures = [];
  for (const [label, rule] of contentRules) {
    if (rule.test(line)) failures.push(label);
  }
  if (isCommentLike(path, line)) {
    if (/#\d{2,}\b/u.test(line)) failures.push("work-item number in active comment/documentation");
  }
  return failures;
}

export function scanActiveProvenance({ root = repoRoot, inputs = activeInputs } = {}) {
  const failures = [];
  const files = [...new Set(inputs.flatMap((input) => walkInput(input, root)))]
    .filter((path) => path !== guardPath)
    .sort((a, b) => a.localeCompare(b));

  for (const path of files) {
    if (isActiveCheckedPath(path)) {
      for (const [label, rule] of pathRules) {
        if (rule.test(path)) failures.push(`${label}: ${path}`);
      }
    }
    if (!isText(path)) continue;

    const lines = readFileSync(resolve(root, path), "utf8").split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const label of lineFailures(path, line)) {
        failures.push(`${label}: ${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return failures;
}

function collectExplicitClassificationInventory({ root = repoRoot } = {}) {
  const inventory = [];

  for (const entry of explicitClassifications) {
    if (entry.path === guardPath) {
      inventory.push({ ...entry, location: entry.path });
      continue;
    }

    const lines = readFileSync(resolve(root, entry.path), "utf8").split(/\r?\n/u);
    const matches = lines
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => entry.linePattern?.test(line));

    if (matches.length !== 1) {
      throw new Error(`explicit provenance classification ${entry.id} expected exactly one occurrence in ${entry.path}, found ${matches.length}`);
    }

    inventory.push({
      ...entry,
      location: `${entry.path}:${matches[0].lineNumber}`,
      occurrence: matches[0].line.trim(),
    });
  }

  return inventory;
}

function printExplicitClassificationInventory() {
  const inventory = collectExplicitClassificationInventory();
  console.log(`Explicit active-provenance classifications (${inventory.length}):`);
  for (const entry of inventory) {
    const occurrence = entry.occurrence ? ` — ${entry.occurrence}` : "";
    console.log(`- ${entry.id}: ${entry.location} [${entry.kind}]${occurrence}`);
    console.log(`  ${entry.reason}`);
  }
}

function selfTest() {
  const workItemPath = `issue-${"999"}-foo.test.ts`;
  const numberedSpec = `test/e2e/plasmon-foo-${"999"}.spec.ts`;
  const camelCaseTest = `startMenuReconciliation${"999"}.test.ts`;
  const workItemTag = `@issue-${"999"}`;
  const releaseTag = `@r${"2"}-quarantine`;
  const legacyReleaseBranchA = ["release", `0.1.0-r${"2"}`].join("/");
  const legacyReleaseBranchB = ["release", `0.1.0-r${"3"}`].join("/");
  const testTitle = `test("behavior from #${"999"} remains forbidden", () => {})`;
  const artifact = `issue-${"999"}-graphite.png`;
  const diagnostic = `console.log("::error title=#${"999"} stale work item::failure")`;

  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "plasmon-active-provenance-"));
  try {
    mkdirSync(resolve(fixtureRoot, "test/e2e"), { recursive: true });
    mkdirSync(resolve(fixtureRoot, "apps/review/src"), { recursive: true });
    writeFileSync(resolve(fixtureRoot, "apps/review/src", "issue-999.scss"), ".review {}\n");
    writeFileSync(resolve(fixtureRoot, "test", workItemPath), "export {};\n");
    writeFileSync(resolve(fixtureRoot, numberedSpec), [
      testTitle,
      `// ${workItemTag}`,
      `// ${releaseTag}`,
      `const legacyBranchA = "${legacyReleaseBranchA}";`,
      `const legacyBranchB = "${legacyReleaseBranchB}";`,
      `const evidence = "${artifact}";`,
      diagnostic,
    ].join("\n"));
    writeFileSync(resolve(fixtureRoot, "test", camelCaseTest), "export {};\n");

    const fixtureFailures = scanActiveProvenance({ root: fixtureRoot, inputs: ["test", "apps/review/src"] });
    const expectedFailures = [
      `Issue-numbered active path: apps/review/src/issue-999.scss`,
      `Issue-numbered active path: test/${workItemPath}`,
      `numbered Plasmon browser spec: ${numberedSpec}`,
      `camelCase work-item test suffix: test/${camelCaseTest}`,
      "Issue tag:",
      "release-numbered tag:",
      "work-item number in test title:",
      "Issue-numbered active artifact/resource:",
      "work-item number in active Actions diagnostic:",
      `concrete release branch coupling: ${numberedSpec}:4:`,
      `concrete release branch coupling: ${numberedSpec}:5:`,
    ];
    for (const expected of expectedFailures) {
      if (!fixtureFailures.some((failure) => failure.includes(expected))) {
        throw new Error(`guard self-test did not report scanner failure: ${expected}`);
      }
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
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
    throw new Error("guard self-test lost the bounded quarantine repair-owner classification");
  }
  if (explicitClassifications.length !== 4) {
    throw new Error("guard self-test expected the complete explicit classification inventory to remain narrowly bounded");
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
    printExplicitClassificationInventory();
  }
}