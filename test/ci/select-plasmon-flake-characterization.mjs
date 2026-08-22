import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyPlasmonTest,
  discoverPlasmonTests,
  repoRoot as defaultRepoRoot,
} from "./plasmon-test-inventory.mjs";

const playwrightTestPattern =
  /^test\/e2e\/.+\.(?:spec|test)\.[cm]?[jt]sx?$/;
const playwrightSpecPattern = /^test\/e2e\/.+\.spec\.[cm]?[jt]sx?$/;
const sourceExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const importExtensionCandidates = [
  "",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.mjs",
];

export const sharedFallbackInputs = Object.freeze([
  "playwright.config.ts",
  ".github/workflows/plasmon-flake-probe.yml",
  ".github/workflows/plasmon-browser-ci.yml",
  ".github/workflows/plasmon-browser-smoke-ci.yml",
  ".github/workflows/plasmon-browser-persistence-ci.yml",
  "test/ci/run-plasmon-flake-probe.sh",
  "test/ci/run-plasmon-specialist.mjs",
  "test/ci/plasmon-test-inventory.mjs",
  "test/ci/select-plasmon-flake-characterization.mjs",
]);

const deletedSharedHelperFallbacks = new Set([
  "test/e2e/local-playwright-identity.ts",
]);

function slash(path) {
  return path.replaceAll("\\", "/");
}

function repoPath(path, root) {
  return slash(relative(root, path));
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walkFiles(path));
    else if (statSync(path).isFile()) files.push(path);
  }
  return files;
}

function isSourcePath(path) {
  return sourceExtensions.has(extname(path));
}

function staticImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"'\n]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveRelativeImport(importer, specifier, root) {
  if (!specifier.startsWith(".")) return null;
  const importerAbsolute = resolve(root, importer);
  const base = resolve(dirname(importerAbsolute), specifier);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (base !== root && !base.startsWith(rootPrefix)) return null;

  for (const suffix of importExtensionCandidates) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return repoPath(candidate, root);
    }
  }
  return null;
}

function repositoryPathReferences(source, sourcePaths) {
  // Some browser fixtures are intentionally handed to bundlers/runners by a
  // repository-root string path rather than a JS import. Treat an exact source
  // path literal as a dependency edge so those helpers still get the narrowest
  // resolvable characterization scope.
  return sourcePaths.filter((candidate) => source.includes(candidate));
}

function buildSourceGraph(root) {
  const e2eRoot = resolve(root, "test/e2e");
  const sources = new Map();
  for (const file of walkFiles(e2eRoot)) {
    const path = repoPath(file, root);
    if (isSourcePath(path)) sources.set(path, readFileSync(file, "utf8"));
  }

  const sourcePaths = [...sources.keys()];
  const graph = new Map();
  for (const [path, source] of sources) {
    const dependencies = new Set(
      staticImportSpecifiers(source)
        .map((specifier) => resolveRelativeImport(path, specifier, root))
        .filter(Boolean),
    );
    for (const dependency of repositoryPathReferences(source, sourcePaths)) {
      if (dependency !== path) dependencies.add(dependency);
    }
    graph.set(path, dependencies);
  }
  return { sources, graph };
}

function dependsOn(path, dependency, graph, visiting = new Set()) {
  if (path === dependency) return true;
  if (visiting.has(path)) return false;
  visiting.add(path);
  for (const child of graph.get(path) ?? []) {
    if (child === dependency || dependsOn(child, dependency, graph, visiting)) {
      visiting.delete(path);
      return true;
    }
  }
  visiting.delete(path);
  return false;
}

function usesPlaywright(path, graph, sources, memo = new Map(), visiting = new Set()) {
  if (memo.has(path)) return memo.get(path);
  if (visiting.has(path)) return false;
  visiting.add(path);
  const source = sources.get(path) ?? "";
  let result = source.includes("@playwright/test");
  if (!result) {
    result = [...(graph.get(path) ?? [])].some((dependency) =>
      usesPlaywright(dependency, graph, sources, memo, visiting),
    );
  }
  visiting.delete(path);
  memo.set(path, result);
  return result;
}

function isRelevantPlaywrightTest(path, graph, sources, playwrightMemo) {
  if (!playwrightTestPattern.test(path)) return false;
  const classification = classifyPlasmonTest(path);
  if (classification?.layer === "non-plasmon-browser") return false;

  // Repository inventory classifies Playwright *.spec.* files. A future
  // Playwright *.test.* file is also eligible, but only when its import graph
  // actually reaches @playwright/test so Bun-only tests under test/e2e are not
  // accidentally handed to the Playwright runner.
  if (playwrightSpecPattern.test(path)) return true;
  return usesPlaywright(path, graph, sources, playwrightMemo);
}

function supportPathNeedsFallback(path, root, impactedCount) {
  if (impactedCount > 0) return false;
  const absolute = resolve(root, path);
  if (!path.startsWith("test/e2e/") || playwrightTestPattern.test(path) || !isSourcePath(path)) {
    return false;
  }
  // Any changed E2E source helper/fixture whose Plasmon consumers cannot be
  // resolved must fail closed. Filename prefixes are not an ownership proof:
  // helpers such as permission-dialog.fixture.tsx can be reached through
  // runner/bundler path strings instead of static imports.
  if (existsSync(absolute)) return true;
  return deletedSharedHelperFallbacks.has(path);
}

function selectionHash(files) {
  return createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
}

export async function selectCharacterization({
  changedFiles,
  root = defaultRepoRoot,
} = {}) {
  if (!Array.isArray(changedFiles)) {
    throw new TypeError("changedFiles must be an array");
  }

  const normalizedChanged = [...new Set(changedFiles.map(slash).filter(Boolean))].sort();
  const { sources, graph } = buildSourceGraph(root);
  const playwrightMemo = new Map();
  const relevantTests = [...sources.keys()]
    .filter((path) => isRelevantPlaywrightTest(path, graph, sources, playwrightMemo))
    .sort();
  const relevantSet = new Set(relevantTests);

  const directChangedTests = normalizedChanged.filter(
    (path) => relevantSet.has(path) && existsSync(resolve(root, path)),
  );

  const impactedTests = new Set();
  const unresolvedSupport = [];
  for (const path of normalizedChanged) {
    if (!path.startsWith("test/e2e/") || playwrightTestPattern.test(path) || !isSourcePath(path)) {
      continue;
    }
    const impacted = relevantTests.filter((test) => dependsOn(test, path, graph));
    impacted.forEach((test) => impactedTests.add(test));
    if (supportPathNeedsFallback(path, root, impacted.length)) unresolvedSupport.push(path);
  }

  const fallbackInputs = [
    ...normalizedChanged.filter((path) => sharedFallbackInputs.includes(path)),
    ...unresolvedSupport,
  ].filter((value, index, values) => values.indexOf(value) === index).sort();

  const exactTargets = new Set([...directChangedTests, ...impactedTests]);
  if (fallbackInputs.length > 0) {
    const inventory = await discoverPlasmonTests(root);
    for (const test of inventory) {
      if (test.layer === "browser" && test.lane === "specialist") exactTargets.add(test.path);
    }
  }

  const files = [...exactTargets].sort();
  if (files.length === 0) {
    return {
      applicable: false,
      reason: "no-relevant-playwright-change",
      target: "exact-set",
      iteration_count: 50,
      files: [],
      files_json: "[]",
      scope: "not-applicable",
      scope_key: "not-applicable",
      direct_changed_tests: directChangedTests,
      impacted_tests: [...impactedTests].sort(),
      fallback_inputs: fallbackInputs,
    };
  }

  const fallback = fallbackInputs.length > 0;
  const reason = fallback
    ? "shared-support-fallback"
    : directChangedTests.length > 0 && impactedTests.size > 0
      ? "changed-tests-and-impacted-support"
      : directChangedTests.length > 0
        ? "changed-playwright-tests"
        : "impacted-playwright-support";
  const digest = selectionHash(files);
  const scope = `characterization:${fallback ? "specialist-fallback" : "targeted"}:${files.length}-files:${digest}`;
  const scopeKey = `char-${fallback ? "fallback" : "targeted"}-${files.length}-${digest}`;

  return {
    applicable: true,
    reason,
    target: "exact-set",
    iteration_count: 50,
    files,
    files_json: JSON.stringify(files),
    scope,
    scope_key: scopeKey,
    direct_changed_tests: directChangedTests,
    impacted_tests: [...impactedTests].sort(),
    fallback_inputs: fallbackInputs,
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const changedFilesPath = args[0];
  if (!changedFilesPath || changedFilesPath.startsWith("--")) {
    console.error(
      "usage: node test/ci/select-plasmon-flake-characterization.mjs <changed-files> [--github-output <path>] [--json-file <path>]",
    );
    process.exit(2);
  }

  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const selection = await selectCharacterization({ changedFiles });
  const json = JSON.stringify(selection);
  console.log(json);

  const outputPath = optionValue(args, "--github-output");
  if (outputPath) {
    const fields = {
      applicable: String(selection.applicable),
      reason: selection.reason,
      target: selection.target,
      iteration_count: String(selection.iteration_count),
      files_json: selection.files_json,
      scope: selection.scope,
      scope_key: selection.scope_key,
    };
    appendFileSync(
      outputPath,
      Object.entries(fields).map(([key, value]) => `${key}=${value}\n`).join(""),
    );
  }

  const jsonPath = optionValue(args, "--json-file");
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(selection, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
