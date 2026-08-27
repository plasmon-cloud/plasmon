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
  optionalCoreBrowserTests,
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

// These inputs can affect Playwright execution, but they do not identify an
// acceptance target on their own. Automatic characterization must never turn
// uncertainty here into a 50x whole-Specialist run.
export const unresolvedSharedInputs = Object.freeze([
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
  if (playwrightSpecPattern.test(path)) return true;
  return usesPlaywright(path, graph, sources, playwrightMemo);
}

function isQuarantinedAcceptance(path, sources) {
  return (sources.get(path) ?? "").includes("@r2-quarantine");
}

function unresolvedSupportInput(path, root, impactedCount) {
  if (impactedCount > 0) return false;
  if (!path.startsWith("test/e2e/") || playwrightTestPattern.test(path) || !isSourcePath(path)) {
    return false;
  }
  return existsSync(resolve(root, path));
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
  const excludedQuarantinedTests = new Set(
    directChangedTests.filter((path) => isQuarantinedAcceptance(path, sources)),
  );

  const impactedTests = new Set();
  const unresolvedInputs = new Set(
    normalizedChanged.filter((path) => unresolvedSharedInputs.includes(path)),
  );

  for (const path of normalizedChanged) {
    if (!path.startsWith("test/e2e/") || playwrightTestPattern.test(path) || !isSourcePath(path)) {
      continue;
    }
    const impacted = relevantTests.filter((test) => dependsOn(test, path, graph));
    for (const test of impacted) {
      if (isQuarantinedAcceptance(test, sources)) excludedQuarantinedTests.add(test);
      else impactedTests.add(test);
    }
    if (unresolvedSupportInput(path, root, impacted.length)) unresolvedInputs.add(path);
  }

  const exactTargets = new Set(
    directChangedTests.filter((path) => !excludedQuarantinedTests.has(path)),
  );
  for (const test of impactedTests) exactTargets.add(test);

  const profileSpecificTargets = [...exactTargets].filter((path) =>
    optionalCoreBrowserTests.includes(path),
  );
  const ordinaryTargets = [...exactTargets].filter((path) =>
    !optionalCoreBrowserTests.includes(path),
  );
  // The packet harness provisions one deployment per characterization. Keep a
  // mixed changed-test set on the local profile so ordinary tests retain their
  // strict BrowserHealth boundary; profile-specific tests are covered by the
  // dedicated demo acceptance lane rather than silently run against local.
  const deferredProfileTests = ordinaryTargets.length > 0
    ? profileSpecificTargets.sort()
    : [];
  const files = (ordinaryTargets.length > 0 ? ordinaryTargets : profileSpecificTargets).sort();
  const unresolved = [...unresolvedInputs].sort();
  const excluded = [...excludedQuarantinedTests].sort();

  if (files.length === 0) {
    const reason = excluded.length > 0 && unresolved.length === 0
      ? "only-quarantined-playwright-changes"
      : unresolved.length > 0
        ? "no-deterministic-playwright-target"
        : "no-relevant-playwright-change";
    return {
      applicable: false,
      reason,
      target: "exact-set",
      iteration_count: 50,
      files: [],
      files_json: "[]",
      scope: "not-applicable",
      scope_key: "not-applicable",
      direct_changed_tests: directChangedTests,
      impacted_tests: [...impactedTests].sort(),
      excluded_quarantined_tests: excluded,
      unresolved_inputs: unresolved,
      deferred_profile_tests: deferredProfileTests,
    };
  }

  const reason = directChangedTests.some((path) => exactTargets.has(path)) && impactedTests.size > 0
    ? "changed-tests-and-impacted-support"
    : directChangedTests.some((path) => exactTargets.has(path))
      ? "changed-playwright-tests"
      : "impacted-playwright-support";
  const digest = selectionHash(files);
  const scope = `characterization:targeted:${files.length}-files:${digest}`;
  const scopeKey = `char-targeted-${files.length}-${digest}`;

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
    excluded_quarantined_tests: excluded,
    unresolved_inputs: unresolved,
    deferred_profile_tests: deferredProfileTests,
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const changedFilesPath = args.find((arg) => !arg.startsWith("--")) ?? null;
  const githubOutputPath = optionValue(args, "--github-output");
  const jsonFilePath = optionValue(args, "--json-file");
  if (!changedFilesPath) {
    throw new Error("Usage: select-plasmon-flake-characterization.mjs <changed-files.txt> [--github-output <path>] [--json-file <path>]");
  }

  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const selection = await selectCharacterization({ changedFiles });
  const json = `${JSON.stringify(selection)}\n`;
  process.stdout.write(json);
  if (jsonFilePath) writeFileSync(jsonFilePath, json);
  if (githubOutputPath) {
    for (const key of [
      "applicable",
      "reason",
      "target",
      "iteration_count",
      "files_json",
      "scope",
      "scope_key",
    ]) {
      appendFileSync(githubOutputPath, `${key}=${selection[key]}\n`);
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
