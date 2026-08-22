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

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const workflowReadmePath = ".github/workflows/README.md";
const labelWorkflowPath = ".github/workflows/plasmon-flake-probe-label.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const specialistRunnerPath = "test/ci/run-plasmon-specialist.mjs";
const summarizerPath = "test/ci/summarize-flake-probe.mjs";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
const workflowReadme = readFileSync(workflowReadmePath, "utf8");
const labelWorkflow = readFileSync(labelWorkflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const specialistRunner = readFileSync(specialistRunnerPath, "utf8");
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
  "iteration_count: ${{ steps.configure.outputs.iteration_count }}",
  "iterations: ${{ steps.configure.outputs.iterations }}",
  "scope: ${{ steps.configure.outputs.scope }}",
  "scope_key: ${{ steps.configure.outputs.scope_key }}",
  "iteration_count=10",
  "target=all",
  "10|50",
  "target=exact requires test/e2e/**/*.spec.* or *.test.*",
  "Array.from({length:n}, (_, index) => index + 1)",
  "if: needs.applicability.outputs.applicable == 'true'",
  "name: Flake probe ${{ needs.applicability.outputs.scope }} iteration ${{ matrix.iteration }}/${{ needs.applicability.outputs.iteration_count }}",
  "max-parallel: 10",
  "iteration: ${{ fromJSON(needs.applicability.outputs.iterations) }}",
  "PROBE_TARGET: ${{ needs.applicability.outputs.target }}",
  "PROBE_TEST_FILE: ${{ needs.applicability.outputs.test_file }}",
  "PROBE_TEST_GREP: ${{ needs.applicability.outputs.test_grep }}",
  "PROBE_ITERATION_COUNT: ${{ needs.applicability.outputs.iteration_count }}",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "run_number=${{ github.run_number }}",
  "run_attempt=${{ github.run_attempt }}",
  "iteration=${{ matrix.iteration }}",
  "iteration_count=${PROBE_ITERATION_COUNT:-unknown}",
  "scope=${PROBE_SCOPE:-unknown}",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\" \"$PROBE_TEST_FILE\" \"$PROBE_TEST_GREP\"",
  "flake-probe-${{ needs.applicability.outputs.iteration_count }}-${{ needs.applicability.outputs.scope_key }}-iteration-result-${{ github.run_id }}-${{ matrix.iteration }}",
  "flake-probe-${{ needs.applicability.outputs.iteration_count }}-${{ needs.applicability.outputs.scope_key }}-iteration-diagnostics-${{ github.run_id }}-${{ matrix.iteration }}",
  "Probe iteration: ${{ matrix.iteration }}/${PROBE_ITERATION_COUNT:-unknown}",
  "Workflow run_number: ${{ github.run_number }}",
  "Workflow run_attempt: ${{ github.run_attempt }}",
  "name: Flake probe summary",
  "needs: [applicability, probe]",
  "node test/ci/summarize-flake-probe.mjs",
]) {
  requireFragment(workflow, fragment, "flake-probe workflow");
}

for (const fragment of [
  "    paths:",
  "continue-on-error: true",
  "matrix.attempt",
  "attempt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "--repeat-each",
  "--pass-with-no-tests",
  "paths-ignore",
  "pull_request_target",
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
  "test/e2e/*.spec.*|test/e2e/*.test.*",
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
  "probeIteration",
  "result.iteration",
  "result.attempt",
  "resultIterationCount",
  "iteration_count",
  "expectedCount",
  "run_number",
  "run_attempt",
  "Scope:",
  "Configured probe iterations:",
  "Fresh probe iterations reported",
  "Iteration-1 passes",
  "Failed probe iterations",
  "Legacy result files parsed",
  "STABILITY OBSERVED:",
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
  requireFragment(workflowReadme, fragment, "flake-probe documentation");
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

function writeResult(root, iteration, count, fields = {}) {
  const directory = join(root, `iteration-${iteration}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "result.txt"),
    [
      "run_id=fixture-run-id",
      "run_number=317",
      "run_attempt=2",
      `iteration=${iteration}`,
      `iteration_count=${count}`,
      `outcome=${fields.outcome ?? "success"}`,
      "sha=fixture-sha",
      `target=${fields.target ?? "exact"}`,
      `scope=${fields.scope ?? "exact:test/e2e/changed.spec.ts"}`,
      "test_file=test/e2e/changed.spec.ts",
      "test_grep=",
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
    for (const fragment of [
      "Workflow `run_number`: `317`",
      "Workflow `run_attempt`: `2`",
      "Target: `exact`",
      "Scope: `exact:test/e2e/changed.spec.ts`",
      `Configured probe iterations: ${count}`,
      `Fresh probe iterations reported: ${count}/${count}`,
      `Iteration-1 passes: ${count}/${count}`,
      `STABILITY OBSERVED: ${count}/${count} fresh probe iterations passed.`,
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

function verifyPriorIterationResultCompatibility() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-prior-iteration-summary-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "");
    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const directory = join(resultsRoot, `iteration-${iteration}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "result.txt"),
        [
          "run_id=prior-iteration-run-id",
          "run_number=291",
          "run_attempt=2",
          `iteration=${iteration}`,
          "outcome=success",
          "sha=prior-iteration-sha",
          "target=all",
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
      throw new Error(`prior iteration result fixture must remain readable: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    for (const fragment of [
      "Workflow `run_number`: `291`",
      "Workflow `run_attempt`: `2`",
      "Target: `all`",
      "Scope: `all`",
      "Configured probe iterations: 10",
      "Fresh probe iterations reported: 10/10",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(summaryRun.stdout, fragment, "prior iteration result compatibility fixture");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

runSummaryFixture(10);
runSummaryFixture(50);
verifyLegacyResultCompatibility();
verifyPriorIterationResultCompatibility();

console.log(
  "Flake-probe configurable 10/50 iteration count, explicit named/exact scope, exact-head checkout, retry-zero, worker-one, fresh local fixture, run metadata, scope-bearing artifacts/results, automatic 10-iteration default, exact quarantined-test reachability, and historical ten-iteration summary compatibility contracts verified",
);
