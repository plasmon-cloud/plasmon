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
const deadCommentFixture = [
  "# npm run plasmon:local:prepare",
  "true # npm run plasmon:local:serve",
  "# npm run plasmon:local:status",
  "# npm run plasmon:local:reinstall",
].join("\n");
for (const fragment of [
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
  "npm run plasmon:local:reinstall",
]) {
  forbidFragment(
    executableShellSource(deadCommentFixture),
    fragment,
    "flake-probe executable-shell parser must ignore dead comments",
  );
}

const workflowFragments = [
  "name: Plasmon Flake Probe",
  "types: [opened, synchronize, reopened]",
  "workflow_dispatch:",
  "group: plasmon-flake-probe-${{ github.event.pull_request.number || github.ref }}",
  "cancel-in-progress: true",
  "applicability:",
  "name: Determine flake probe applicability",
  "fetch-depth: 0",
  "git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\"",
  "apps/plasmon/src/*.test.*",
  "apps/plasmon/src/*.spec.*",
  "apps/plasmon/test/*",
  "test/e2e/*",
  "test/ci/*",
  "playwright.config.ts",
  "package.json",
  "package-lock.json",
  "flake.nix",
  "flake.lock",
  ".github/workflows/plasmon-flake-probe.yml",
  "echo \"applicable=$applicable\" >> \"$GITHUB_OUTPUT\"",
  "name: flake-probe-applicability-${{ github.run_id }}",
  "if: needs.applicability.outputs.applicable == 'true'",
  "needs: applicability",
  "fail-fast: false",
  "max-parallel: 10",
  "iteration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "name: Flake probe iteration ${{ matrix.iteration }}/10",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "echo \"iteration=${{ matrix.iteration }}/10\"",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\"",
  "2>&1 | tee flake-probe-output.log",
  "run_id=${{ github.run_id }}",
  "run_number=${{ github.run_number }}",
  "run_attempt=${{ github.run_attempt }}",
  "iteration=${{ matrix.iteration }}",
  "name: flake-probe-iteration-result-${{ github.run_id }}-${{ matrix.iteration }}",
  "name: flake-probe-iteration-diagnostics-${{ github.run_id }}-${{ matrix.iteration }}",
  "cp flake-probe-result/result.txt flake-probe-diagnostics/result.txt",
  "cp flake-probe-output.log flake-probe-diagnostics/probe-output.log",
  "name: Report observed probe failure",
  "context_file=\"$(find test-results -name error-context.md -type f -print -quit 2>/dev/null || true)\"",
  "Probe iteration: ${{ matrix.iteration }}/10",
  "Workflow run_number: ${{ github.run_number }}",
  "Workflow run_attempt: ${{ github.run_attempt }}",
  "Exact SHA: \\`${PROBE_SHA:-unknown}\\`",
  "Target: \\`${PROBE_TARGET:-unknown}\\`",
  "Actions run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}",
  "Diagnostic artifact: \\`$diagnostic_artifact\\`",
  "uses: actions/upload-artifact@v4",
  "overwrite: true",
  "summary:",
  "if: ${{ always() && (needs.applicability.result != 'success' || needs.applicability.outputs.applicable == 'true') }}",
  "name: Flake probe summary",
  "needs: [applicability, probe]",
  "name: Require successful applicability detection",
  "name: Download applicability evidence",
  "name: Download probe iteration results",
  "pattern: flake-probe-iteration-result-${{ github.run_id }}-*",
  "name: Download failed-probe-iteration diagnostics",
  "if: needs.probe.result != 'success'",
  "pattern: flake-probe-iteration-diagnostics-${{ github.run_id }}-*",
  "node test/ci/summarize-flake-probe.mjs",
  "| tee -a \"$GITHUB_STEP_SUMMARY\"",
];
for (const fragment of workflowFragments) {
  requireFragment(workflow, fragment, "flake-probe workflow");
}

forbidFragment(
  workflow,
  "    paths:",
  "flake-probe pull_request trigger must instantiate the required summary for every PR",
);
forbidFragment(
  workflow,
  "continue-on-error: true",
  "flake-probe workflow must let the real probe step own the job failure",
);

for (const fragment of [
  "matrix.attempt",
  "attempt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "name: Upload attempt result",
  "name: Download attempt results",
  "name: Download failed-attempt diagnostics",
  "Plasmon flake probe attempt failure",
  "- Attempt:",
]) {
  forbidFragment(
    workflow,
    fragment,
    "flake-probe workflow must reserve attempt terminology for GitHub run_attempt only",
  );
}

for (const fragment of [
  "flake-probe-applicability-${{ github.run_id }}-${{ github.run_attempt }}",
  "flake-probe-iteration-result-${{ github.run_id }}-${{ github.run_attempt }}-",
  "flake-probe-iteration-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}-",
]) {
  forbidFragment(
    workflow,
    fragment,
    "flake-probe artifacts must survive partial failed-job reruns by using stable logical-slot names",
  );
}

const overwriteCount = workflow.split("overwrite: true").length - 1;
if (overwriteCount < 3) {
  throw new Error(
    "flake-probe applicability, result, and diagnostic artifacts must be overwrite-safe for workflow reruns",
  );
}

const reportStart = workflow.indexOf("      - name: Report observed probe failure");
const summaryStart = workflow.indexOf("\n  summary:", reportStart);
if (reportStart === -1 || summaryStart === -1) {
  throw new Error("flake-probe workflow lost the failure-report/summary boundary");
}
const reportBlock = workflow.slice(reportStart, summaryStart);
forbidFragment(
  reportBlock,
  "exit 1",
  "flake-probe failure reporter must remain informational after the probe step fails",
);

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

for (const option of [
  "all",
  "specialist",
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
  "saved-preview",
]) {
  requireFragment(
    workflow,
    `          - ${option}`,
    "flake-probe dispatch target choices",
  );
}

const runnerFragments = [
  "npm ci",
  "all)",
  "node test/ci/verify-flake-probe.mjs",
  "node test/ci/verify-plasmon-test-inventory.mjs",
  "npm --workspace neutron-plasmon test",
  "npm --workspace neutron-plasmon run test:package",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve > /tmp/plasmon-pocketic.log 2>&1 &",
  "npm run plasmon:local:status",
  "npm run plasmon:local:reinstall",
  "for poll in $(seq 1 180)",
  "--workers=1",
  "--retries=0",
  "npm run test:e2e:plasmon:specialist -- --retries=0",
  "run_one test/e2e/plasmon-golden-path-right-snap.spec.ts",
  "run_one test/e2e/plasmon-golden-path-left-snap.spec.ts",
  "run_one test/e2e/plasmon-golden-path-window-lifetime.spec.ts",
  "run_one test/e2e/plasmon-monaco-packaged.spec.ts",
  "run_one test/e2e/plasmon-emulatorjs-proof.spec.ts",
  "run_one test/e2e/plasmon-demo-game.spec.ts --grep @issue-304",
];
for (const fragment of runnerFragments) {
  requireFragment(executableRunner, fragment, "flake-probe executable runner");
}

for (const fragment of [
  "plasmon:demo:prepare",
  "plasmon:demo:serve",
  "plasmon:demo:status",
  "plasmon:demo:reinstall",
  "for attempt in $(seq 1 180)",
]) {
  forbidFragment(
    runner,
    fragment,
    "flake-probe runner must not retain obsolete lifecycle or ambiguous polling terminology",
  );
}

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string") {
  throw new Error("package.json lost test:e2e:plasmon:specialist");
}
requireFragment(
  specialistScript,
  "test/ci/run-plasmon-specialist.mjs",
  "required Specialist npm script",
);
for (const fragment of [
  "discoverPlasmonTests",
  "lane === 'specialist'",
  "--workers=1",
  "--grep-invert",
  "@r2-quarantine",
]) {
  requireFragment(
    specialistRunner,
    fragment,
    "automatic Specialist runner",
  );
}

for (const fragment of [
  "probeIteration",
  "result.iteration",
  "result.attempt",
  "run_number",
  "run_attempt",
  "Fresh probe iterations reported",
  "Iteration-1 passes",
  "Failed probe iterations",
  "Failure summary",
  "failure occurrence(s)",
  "Unique failing tests parsed",
  "MODIFIED IN PR",
  "UNCHANGED IN PR",
  "probe iteration(s)",
  "Legacy result files parsed",
  "Failed probe iterations without a parsed test identity",
  "SUMMARY INTEGRITY FAILURE",
  "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
  "FLAKE/FAILURE OBSERVED:",
  "process.exitCode = 1",
  "extractFailures",
  "playwrightRunFailure",
  "playwrightDetailFailure",
]) {
  requireFragment(summarizer, fragment, "flake-probe aggregate summarizer");
}

for (const fragment of [
  "Fresh attempts reported",
  "First-attempt passes",
  "Failed attempts:",
  "attempt(s)",
  "Failed attempts without a parsed test identity",
  "fresh attempts passed",
]) {
  forbidFragment(
    summarizer,
    fragment,
    "flake-probe user-facing summary must use probe iteration terminology",
  );
}

for (const fragment of [
  "**workflow run** / `run_number`",
  "**workflow run attempt** / `run_attempt`",
  "**probe iteration**",
  "**test retry**",
  "iteration=<n>",
  "legacy alias",
  "new workflow output must not emit the legacy field",
]) {
  requireFragment(workflowReadme, fragment, "flake-probe terminology documentation");
}
for (const fragment of [
  "ten independent attempts",
  "first-attempt pass is green",
]) {
  forbidFragment(
    workflowReadme,
    fragment,
    "flake-probe documentation must distinguish probe iterations from test retries",
  );
}

for (const fragment of [
  "--repeat-each",
  "--pass-with-no-tests",
  "paths-ignore",
  "pull_request_target",
  "run: exit 1",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
  forbidFragment(executableRunner, fragment, "flake-probe executable runner");
}

forbidFragment(
  executableRunner,
  "--grep-invert @r2-quarantine",
  "targeted flake-probe executable runner",
);

const iterations = workflow.match(/iteration: \[([^\]]+)\]/)?.[1]
  ?.split(",")
  .map((value) => Number(value.trim()));
if (
  !iterations ||
  iterations.length !== 10 ||
  iterations.some((value, index) => value !== index + 1)
) {
  throw new Error(
    "flake-probe workflow must define exactly ten numbered fresh probe iterations",
  );
}

const retryZeroCount = executableRunner.split("--retries=0").length - 1;
if (retryZeroCount < 2) {
  throw new Error(
    "flake-probe runner must disable test retries for full and targeted probes",
  );
}

const workerOneCount =
  executableRunner.split("--workers=1").length - 1 +
  specialistRunner.split("--workers=1").length - 1;
if (workerOneCount < 2 || !specialistRunner.includes("--workers=1")) {
  throw new Error(
    "flake-probe runner must serialize both targeted and Specialist probes",
  );
}

function verifySummaryParserBehavior() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-summary-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "test/e2e/changed.spec.ts\n");

    const playwrightOutput = [
      "Running 3 tests using 1 worker",
      "  ✓   1 [chromium] › test/e2e/unchanged.spec.ts:10:1 › passing test must not be reported (1.0s)",
      "  ✘   2 [chromium] › test/e2e/changed.spec.ts:20:1 › failure one (5ms)",
      "  ✘   3 [chromium] › test/e2e/changed.spec.ts:30:1 › failure two (8ms)",
      "",
      "  1) [chromium] › test/e2e/changed.spec.ts:20:1 › failure one ─────",
      "  2) [chromium] › test/e2e/changed.spec.ts:30:1 › failure two ─────",
      "",
      "  2 failed",
      "    [chromium] › test/e2e/changed.spec.ts:20:1 › failure one ──────",
      "    [chromium] › test/e2e/changed.spec.ts:30:1 › failure two ──────",
      "  1 passed",
      "",
    ].join("\n");

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const result = [
        "run_id=fixture-run-id",
        "run_number=317",
        "run_attempt=2",
        `iteration=${iteration}`,
        "outcome=failure",
        "sha=fixture-sha",
        "target=all",
        "",
      ].join("\n");
      const resultDirectory = join(resultsRoot, `iteration-${iteration}`);
      const diagnosticDirectory = join(
        diagnosticsRoot,
        `flake-probe-iteration-diagnostics-fixture-${iteration}`,
      );
      mkdirSync(resultDirectory, { recursive: true });
      mkdirSync(diagnosticDirectory, { recursive: true });
      writeFileSync(join(resultDirectory, "result.txt"), result);
      writeFileSync(join(diagnosticDirectory, "result.txt"), result);
      writeFileSync(
        join(diagnosticDirectory, "probe-output.log"),
        playwrightOutput,
      );
    }

    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, GITHUB_EVENT_NAME: "pull_request" },
        encoding: "utf8",
      },
    );
    if (summaryRun.status !== 1) {
      throw new Error(
        `flake-probe summary parser fixture must exit 1 for observed failures; got ${summaryRun.status}: ${summaryRun.stderr}`,
      );
    }

    const summaryOutput = summaryRun.stdout;
    for (const fragment of [
      "Workflow `run_number`: `317`",
      "Workflow `run_attempt`: `2`",
      "Fresh probe iterations reported: 10/10",
      "Iteration-1 passes: 0/10",
      "Failed probe iterations: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
      "Failure occurrences parsed: 20",
      "Unique failing tests parsed: 2",
      "**(20 failure occurrence(s)) `test/e2e/changed.spec.ts` — MODIFIED IN PR**",
      "`failure one` — 10 occurrence(s), probe iteration(s) 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
      "`failure two` — 10 occurrence(s), probe iteration(s) 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
    ]) {
      requireFragment(
        summaryOutput,
        fragment,
        "flake-probe Playwright summary parser fixture",
      );
    }
    for (const fragment of [
      "passing test must not be reported",
      "failure one ─",
      "failure two ─",
      "test/e2e/unchanged.spec.ts",
      "Fresh attempts reported",
      "Failed attempts",
      "attempt(s)",
    ]) {
      forbidFragment(
        summaryOutput,
        fragment,
        "flake-probe Playwright summary parser fixture",
      );
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
      const result = [
        "run_id=legacy-run-id",
        "run_attempt=1",
        `attempt=${legacySlot}`,
        "outcome=success",
        "sha=legacy-sha",
        "target=specialist",
        "",
      ].join("\n");
      const resultDirectory = join(resultsRoot, `attempt-${legacySlot}`);
      mkdirSync(resultDirectory, { recursive: true });
      writeFileSync(join(resultDirectory, "result.txt"), result);
    }

    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    if (summaryRun.status !== 0) {
      throw new Error(
        `legacy flake-probe result fixture must remain readable; got ${summaryRun.status}: ${summaryRun.stderr}`,
      );
    }
    for (const fragment of [
      "Fresh probe iterations reported: 10/10",
      "Iteration-1 passes: 10/10",
      "Legacy result files parsed: 10",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(
        summaryRun.stdout,
        fragment,
        "legacy flake-probe result compatibility fixture",
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

verifySummaryParserBehavior();
verifyLegacyResultCompatibility();

console.log(
  "Flake-probe always-instantiated required-check, cheap applicability detection, job-level not-applicable skip, ten-fresh-probe-iteration, exact-head, retry-zero, target-selection, automatic-test-discovery, executable local-fixture lifecycle, rerun-safe iteration artifacts, explicit workflow-run metadata, backward-compatible legacy result parsing, diagnostic aggregation, failure-identity summary, Playwright failure-only parsing, and changed-file annotation contracts verified",
);
