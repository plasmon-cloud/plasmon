import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot as defaultRepoRoot } from "./plasmon-test-inventory.mjs";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";

const exactFilePattern = /^test\/e2e\/.+\.(?:spec|test)\.[cm]?[jt]sx?$/;
const namedDirectTargets = new Set([
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
  "saved-preview",
]);

function directiveValues(body, name) {
  const pattern = new RegExp(`^\\s*${name}:\\s*(.+?)\\s*$`, "gim");
  return [...String(body ?? "").matchAll(pattern)].map((match) => match[1].trim());
}

function singleDirective(body, name) {
  const values = directiveValues(body, name);
  if (values.length > 1) throw new Error(`${name} may appear at most once`);
  return values[0] ?? "";
}

function validateSingleLine(value, label) {
  if (/[\r\n]/.test(value)) throw new Error(`${label} must be a single line`);
}

function explicitSelection({ targetDirective, grepDirective, root }) {
  validateSingleLine(targetDirective, "Flake-Probe-Target");
  validateSingleLine(grepDirective, "Flake-Probe-Grep");

  if (namedDirectTargets.has(targetDirective)) {
    if (grepDirective) {
      throw new Error("Flake-Probe-Grep is only valid when Flake-Probe-Target is an exact test/e2e file");
    }
    return {
      dispatch: true,
      reason: "explicit-named-target",
      iterations: 50,
      target: targetDirective,
      test_file: "",
      test_grep: "",
      quarantine_excluded: true,
      selection_source: "pr-body",
    };
  }

  if (targetDirective === "all" || targetDirective === "specialist") {
    throw new Error(
      `Flake-Probe-Target ${targetDirective} is not allowed for ci:flake-probe; labeled probes must use a narrow direct target`,
    );
  }

  if (!exactFilePattern.test(targetDirective)) {
    throw new Error(
      "Flake-Probe-Target must be a test/e2e/**/*.spec.* or *.test.* file, or one of: right-snap, left-snap, window-lifetime, monaco, emulatorjs, saved-preview",
    );
  }
  if (!existsSync(resolve(root, targetDirective))) {
    throw new Error(`Flake-Probe-Target does not exist at the exact PR head: ${targetDirective}`);
  }

  return {
    dispatch: true,
    reason: "explicit-exact-target",
    iterations: 50,
    target: "exact",
    test_file: targetDirective,
    test_grep: grepDirective,
    quarantine_excluded: true,
    selection_source: "pr-body",
  };
}

export async function selectLabeledProbe({
  body = "",
  changedFiles = [],
  root = defaultRepoRoot,
} = {}) {
  const targetDirective = singleDirective(body, "Flake-Probe-Target");
  const grepDirective = singleDirective(body, "Flake-Probe-Grep");

  if (grepDirective && !targetDirective) {
    throw new Error("Flake-Probe-Grep requires Flake-Probe-Target");
  }
  if (targetDirective) {
    return explicitSelection({ targetDirective, grepDirective, root });
  }

  const automatic = await selectCharacterization({ changedFiles, root });
  if (!automatic.applicable) {
    return {
      dispatch: false,
      reason: `explicit-target-required:${automatic.reason}`,
      iterations: 50,
      target: "",
      test_file: "",
      test_grep: "",
      quarantine_excluded: true,
      selection_source: "none",
      candidate_files: automatic.files ?? [],
    };
  }

  if (automatic.files.length !== 1) {
    return {
      dispatch: false,
      reason: `explicit-target-required:${automatic.reason}:${automatic.files.length}-files`,
      iterations: 50,
      target: "",
      test_file: "",
      test_grep: "",
      quarantine_excluded: true,
      selection_source: "automatic-candidates",
      candidate_files: automatic.files,
    };
  }

  return {
    dispatch: true,
    reason: "single-automatic-playwright-target",
    iterations: 50,
    target: "exact",
    test_file: automatic.files[0],
    test_grep: "",
    quarantine_excluded: true,
    selection_source: "changed-test-impact",
    candidate_files: automatic.files,
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
      "usage: node test/ci/select-labeled-flake-probe.mjs <changed-files> [--github-output <path>] [--json-file <path>]",
    );
    process.exit(2);
  }

  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const selection = await selectLabeledProbe({
    body: process.env.FLAKE_PROBE_PR_BODY ?? "",
    changedFiles,
  });
  console.log(JSON.stringify(selection));

  const outputPath = optionValue(args, "--github-output");
  if (outputPath) {
    const fields = {
      dispatch: String(selection.dispatch),
      reason: selection.reason,
      iterations: String(selection.iterations),
      target: selection.target,
      test_file: selection.test_file,
      test_grep: selection.test_grep,
      quarantine_excluded: String(selection.quarantine_excluded),
      selection_source: selection.selection_source,
    };
    appendFileSync(
      outputPath,
      Object.entries(fields).map(([key, value]) => `${key}=${value}\n`).join(""),
    );
  }

  const jsonPath = optionValue(args, "--json-file");
  if (jsonPath) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(jsonPath, `${JSON.stringify(selection, null, 2)}\n`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
