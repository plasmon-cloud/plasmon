import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const workflowReadmePath = ".github/workflows/README.md";
const probeDocPath = ".github/workflows/PLASMON_FLAKE_PROBE.md";
const labelWorkflowPath = ".github/workflows/plasmon-flake-probe-label.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const specialistRunnerPath = "test/ci/run-plasmon-specialist.mjs";
const selectorPath = "test/ci/select-plasmon-flake-characterization.mjs";
const summarizerPath = "test/ci/summarize-flake-probe.mjs";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
const workflowReadme = readFileSync(workflowReadmePath, "utf8");
const probeDoc = readFileSync(probeDocPath, "utf8");
const labelWorkflow = readFileSync(labelWorkflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const specialistRunner = readFileSync(specialistRunnerPath, "utf8");
const selector = readFileSync(selectorPath, "utf8");
const summarizer = readFileSync(summarizerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) {
    throw new Error(`${label} lost required fragment: ${fragment}`);
  }
}

function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) {
    throw new Error(`${label} contains forbidden fragment: ${fragment}`);
  }
}

function executableShellSource(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");
}

const executableRunner = executableShellSource(runner);

for (const fragment of [
  "name: Plasmon Flake Probe",
  "types: [opened, synchronize, reopened]",
  "workflow_dispatch:",
  "iterations:",
  "default: '10'",
  "- '10'",
  "- '50'",
  "target:",
  "- exact",
  "test_file:",
  "test_grep:",
  "group: plasmon-flake-probe-${{ github.event.pull_request.number || github.ref }}",
  "cancel-in-progress: true",
  "name: Determine flake probe applicability and configuration",
  "git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\"",
  "apps/plasmon/src/*.test.*",
  "apps/plasmon/src/*.spec.*",
  "apps/plasmon/test/*",
  "test/e2e/*",
  "test/ci/*",
  "playwright.config.ts",
  ".github/workflows/plasmon-flake-probe.yml",
  "primary_mode: ${{ steps.configure.outputs.primary_mode }}",
  "characterization_applicable: ${{ steps.characterize.outputs.applicable }}",
  "characterization_files_json: ${{ steps.characterize.outputs.files_json }}",
  "probe_matrix: ${{ steps.matrix.outputs.matrix }}",
  "primary_mode=baseline",
  "iteration_count=10",
  "target=all",
  "10|50",
  "target=exact requires test/e2e/**/*.spec.* or *.test.*",
  "name: Select automatic 50-iteration characterization scope",
  "node test/ci/select-plasmon-flake-characterization.mjs",
  "--github-output \"$GITHUB_OUTPUT\"",
  "--json-file flake-probe-applicability/characterization.json",
  "name: Build shared probe matrix",
  "mode: 'characterization'",
  "automatic_characterization: true",
  "if: needs.applicability.outputs.applicable == 'true'",
  "matrix: ${{ fromJSON(needs.applicability.outputs.probe_matrix) }}",
  "max-parallel: 10",
  "PROBE_MODE: ${{ matrix.mode }}",
  "PROBE_TEST_FILES_JSON: ${{ matrix.automatic_characterization && needs.applicability.outputs.characterization_files_json || '[]' }}",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\" \"$PROBE_TEST_FILE\" \"$PROBE_TEST_GREP\" \"$PROBE_TEST_FILES_JSON\"",
  "run_number=${{ github.run_number }}",
  "run_attempt=${{ github.run_attempt }}",
  "mode=${PROBE_MODE:-unknown}",
  "iteration=${{ matrix.iteration }}",
  "iteration_count=${PROBE_ITERATION_COUNT:-unknown}",
  "test_files_json=${PROBE_TEST_FILES_JSON:-[]}",
  "flake-probe-${{ matrix.mode }}-${{ matrix.iteration_count }}-${{ matrix.scope_key }}-iteration-result-${{ github.run_id }}-${{ matrix.iteration }}",
  "flake-probe-${{ matrix.mode }}-${{ matrix.iteration_count }}-${{ matrix.scope_key }}-iteration-diagnostics-${{ github.run_id }}-${{ matrix.iteration }}",
  "Probe mode: \\`${PROBE_MODE:-unknown}\\`",
  "Probe iteration: ${{ matrix.iteration }}/${PROBE_ITERATION_COUNT:-unknown}",
  "Workflow run_number: ${{ github.run_number }}",
  "Workflow run_attempt: ${{ github.run_attempt }}",
  "name: Flake probe summary",
  "pattern: flake-probe-${{ needs.applicability.outputs.primary_mode }}-${{ needs.applicability.outputs.iteration_count }}-${{ needs.applicability.outputs.scope_key }}-iteration-result-${{ github.run_id }}-*",
  "name: Flake characterization summary",
  "pattern: flake-probe-characterization-${{ needs.applicability.outputs.characterization_iteration_count }}-${{ needs.applicability.outputs.characterization_scope_key }}-iteration-result-${{ github.run_id }}-*",
  "node test/ci/summarize-flake-probe.mjs",
]) {
  requireFragment(workflow, fragment, "flake-probe workflow");
}

for (const fragment of [
  "    paths:",
  "continue-on-error: true",
  "matrix.attempt",
  "--repeat-each",
  "--pass-with-no-tests",
  "paths-ignore",
  "pull_request_target",
  "ci:flake-probe",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
}

for (const fragment of [
  "name: Plasmon Flake Probe Label Trigger",
  "types: [labeled]",
  "actions: write",
  "ci:flake-probe",
  "createWorkflowDispatch",
  "workflow_id: 'plasmon-flake-probe.yml'",
  "ref: headSha",
  "target: 'all'",
]) {
  requireFragment(labelWorkflow, fragment, "flake-probe label bridge");
}

for (const fragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve > /tmp/plasmon-pocketic.log 2>&1 &",
  "npm run plasmon:local:status",
  "npm run plasmon:local:reinstall",
  "--workers=1",
  "--retries=0",
  "npm run test:e2e:plasmon:specialist -- --retries=0",
  "exact)",
  "exact-set)",
  "test/e2e/*.spec.*|test/e2e/*.test.*",
  "PROBE_TEST_FILES_JSON",
  "exact-set requires a non-empty JSON array",
  "validate_exact_file \"$candidate\"",
  "run_one \"${exact_files[@]}\"",
  "run_one \"$test_file\" --grep \"$test_grep\"",
  "run_one \"$test_file\"",
]) {
  requireFragment(executableRunner, fragment, "flake-probe executable runner");
}
for (const fragment of [
  "plasmon:demo:prepare",
  "plasmon:demo:serve",
  "plasmon:demo:status",
  "plasmon:demo:reinstall",
  "--grep-invert @r2-quarantine",
  "--repeat-each",
]) {
  forbidFragment(executableRunner, fragment, "targeted flake-probe runner");
}

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string") {
  throw new Error("package.json lost test:e2e:plasmon:specialist");
}
requireFragment(specialistScript, "test/ci/run-plasmon-specialist.mjs", "Specialist npm script");
for (const fragment of [
  "discoverPlasmonTests",
  "lane === 'specialist'",
  "--workers=1",
  "--grep-invert",
  "@r2-quarantine",
]) {
  requireFragment(specialistRunner, fragment, "automatic Specialist runner");
}

for (const fragment of [
  "playwrightTestPattern",
  "@playwright/test",
  "classifyPlasmonTest",
  "non-plasmon-browser",
  "dependsOn",
  "sharedFallbackInputs",
  "playwright.config.ts",
  ".github/workflows/plasmon-flake-probe.yml",
  "run-plasmon-flake-probe.sh",
  "lane === \"specialist\"",
  "target: \"exact-set\"",
  "iteration_count: 50",
  "files_json",
  "shared-support-fallback",
  "no-relevant-playwright-change",
]) {
  requireFragment(selector, fragment, "automatic characterization selector");
}

for (const fragment of [
  "probeIteration",
  "result.iteration",
  "result.attempt",
  "resultIterationCount",
  "resultMode",
  "baseline|manual|characterization",
  "iteration_count",
  "run_number",
  "run_attempt",
  "Probe mode:",
  "Configured probe iterations:",
  "Fresh probe iterations reported",
  "Failed probe iterations",
  "Legacy result files parsed",
  "Plasmon 10-iteration baseline flake probe",
  "Plasmon 50-iteration characterization probe",
  "STABILITY EVIDENCE: 50/50",
  "This is evidence, not proof that the target cannot flake.",
  "FLAKE/FAILURE OBSERVED:",
  "process.exitCode = 1",
]) {
  requireFragment(summarizer, fragment, "flake-probe aggregate summarizer");
}

for (const fragment of [
  "Fresh attempts reported",
  "First-attempt passes",
  "Failed attempts:",
  "attempt(s)",
  "fresh attempts passed",
]) {
  forbidFragment(summarizer, fragment, "flake-probe summary terminology");
}

for (const fragment of [
  "**workflow run** / `run_number`",
  "**workflow run attempt** / `run_attempt`",
  "**probe iteration**",
  "**test retry**",
  "iteration=<n>",
  "legacy alias",
]) {
  requireFragment(workflowReadme, fragment, "flake-probe terminology documentation");
}
for (const fragment of [
  "10-iteration baseline",
  "50-iteration characterization",
  "opened`, `reopened`, and `synchronize`",
  "static relative-import",
  "Shared-support fallback",
  "complete current Specialist file inventory",
  "unioned into the fallback set",
  "Flake characterization summary",
  "not proof that the target cannot flake",
]) {
  requireFragment(probeDoc, fragment, "flake-probe characterization documentation");
}

const retryZeroCount = executableRunner.split("--retries=0").length - 1;
if (retryZeroCount < 2) {
  throw new Error("flake-probe runner must disable test retries for full and targeted probes");
}
const workerOneCount =
  executableRunner.split("--workers=1").length - 1 +
  specialistRunner.split("--workers=1").length - 1;
if (workerOneCount < 2 || !specialistRunner.includes("--workers=1")) {
  throw new Error("flake-probe runner must serialize both targeted and Specialist probes");
}

async function verifyCharacterizationSelection() {
  const quarantined = await selectCharacterization({
    changedFiles: ["test/e2e/plasmon-golden-path-left-snap.spec.ts"],
  });
  if (!quarantined.applicable || quarantined.target !== "exact-set") {
    throw new Error("changed quarantined Playwright spec must select exact-set characterization");
  }
  if (!quarantined.files.includes("test/e2e/plasmon-golden-path-left-snap.spec.ts")) {
    throw new Error("changed quarantined Playwright spec was silently excluded from characterization");
  }
  if (quarantined.fallback_inputs.length !== 0) {
    throw new Error("ordinary changed Playwright spec must not force Specialist fallback");
  }

  const helper = await selectCharacterization({
    changedFiles: ["test/e2e/plasmon-browser-health.ts"],
  });
  if (!helper.applicable || helper.files.length === 0) {
    throw new Error("modified Plasmon Playwright helper must select an impacted set or fallback");
  }

  const fallback = await selectCharacterization({
    changedFiles: ["playwright.config.ts"],
  });
  if (!fallback.applicable || fallback.reason !== "shared-support-fallback") {
    throw new Error("shared Playwright configuration must select documented Specialist fallback");
  }
  if (!fallback.files.includes("test/e2e/plasmon-golden-path-left-snap.spec.ts")) {
    throw new Error("Specialist fallback must include current Specialist files directly");
  }

  const combined = await selectCharacterization({
    changedFiles: [
      "playwright.config.ts",
      "test/e2e/plasmon-golden-path-left-snap.spec.ts",
    ],
  });
  if (!combined.files.includes("test/e2e/plasmon-golden-path-left-snap.spec.ts")) {
    throw new Error("fallback must union a directly changed quarantined Playwright spec");
  }

  const unrelated = await selectCharacterization({
    changedFiles: ["test/e2e/contacts-wallet.spec.ts"],
  });
  if (unrelated.applicable) {
    throw new Error("explicitly non-Plasmon Playwright ownership must not receive Plasmon characterization");
  }

  const bunOnly = await selectCharacterization({
    changedFiles: ["test/e2e/plasmon-deployment-environment.test.ts"],
  });
  if (bunOnly.applicable) {
    throw new Error("Bun-only test/e2e *.test.* files must not be misclassified as Playwright tests");
  }
}

function writeResult(root, iteration, count, fields = {}) {
  const directory = join(root, `iteration-${iteration}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "result.txt"),
    [
      "run_id=fixture-run-id",
      "run_number=317",
      "run_attempt=2",
      `mode=${fields.mode ?? (count === 50 ? "characterization" : "baseline")}`,
      `iteration=${iteration}`,
      `iteration_count=${count}`,
      `outcome=${fields.outcome ?? "success"}`,
      "sha=fixture-sha",
      `target=${fields.target ?? (count === 50 ? "exact-set" : "all")}`,
      `scope=${fields.scope ?? (count === 50 ? "characterization:targeted:1-files:fixture" : "all")}`,
      "test_file=",
      "test_grep=",
      `test_files_json=${count === 50 ? '["test/e2e/changed.spec.ts"]' : "[]"}`,
      "",
    ].join("\n"),
  );
}

function runSummaryFixture(count) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `plasmon-flake-${count}-summary-`));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "test/e2e/changed.spec.ts\n");
    for (let iteration = 1; iteration <= count; iteration += 1) {
      writeResult(resultsRoot, iteration, count);
    }
    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      { cwd: process.cwd(), env: { ...process.env, GITHUB_EVENT_NAME: "pull_request" }, encoding: "utf8" },
    );
    if (summaryRun.status !== 0) {
      throw new Error(`${count}-iteration summary fixture failed: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    const expected = count === 50
      ? [
          "## Plasmon 50-iteration characterization probe",
          "Probe mode: `characterization`",
          "Target: `exact-set`",
          "Configured probe iterations: 50",
          "Fresh probe iterations reported: 50/50",
          "STABILITY EVIDENCE: 50/50",
          "This is evidence, not proof that the target cannot flake.",
        ]
      : [
          "## Plasmon 10-iteration baseline flake probe",
          "Probe mode: `baseline`",
          "Target: `all`",
          "Configured probe iterations: 10",
          "Fresh probe iterations reported: 10/10",
          "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
        ];
    for (const fragment of [
      "Workflow `run_number`: `317`",
      "Workflow `run_attempt`: `2`",
      ...expected,
    ]) {
      requireFragment(summaryRun.stdout, fragment, `${count}-iteration summary fixture`);
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyLegacyResultCompatibility() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-legacy-summary-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "");
    for (let legacySlot = 1; legacySlot <= 10; legacySlot += 1) {
      const directory = join(resultsRoot, `attempt-${legacySlot}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "result.txt"),
        [
          "run_id=legacy-run-id",
          "run_attempt=1",
          `attempt=${legacySlot}`,
          "outcome=success",
          "sha=legacy-sha",
          "target=specialist",
          "",
        ].join("\n"),
      );
    }
    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    if (summaryRun.status !== 0) {
      throw new Error(`legacy result fixture must remain readable: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    for (const fragment of [
      "## Plasmon 10-iteration baseline flake probe",
      "Probe mode: `baseline`",
      "Scope: `specialist`",
      "Configured probe iterations: 10",
      "Fresh probe iterations reported: 10/10",
      "Legacy result files parsed: 10",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(summaryRun.stdout, fragment, "legacy result compatibility fixture");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

await verifyCharacterizationSelection();
runSummaryFixture(10);
runSummaryFixture(50);
verifyLegacyResultCompatibility();

console.log(
  "Flake-probe configurable 10/50 count, exact/manual scope, automatic exact-head changed-Playwright characterization, import-resolved helper impact, documented Specialist fallback, quarantined changed-test inclusion, unrelated-owner exclusion, shared matrix execution, retry-zero, worker-one, fresh local fixture, distinct baseline/characterization summaries, run metadata, and legacy ten-iteration compatibility contracts verified",
);
