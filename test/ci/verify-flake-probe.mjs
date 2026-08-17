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
const labelWorkflowPath = ".github/workflows/plasmon-flake-probe-label.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const specialistRunnerPath = "test/ci/run-plasmon-specialist.mjs";
const summarizerPath = "test/ci/summarize-flake-probe.mjs";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
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
  "name: flake-probe-applicability-${{ github.run_id }}-${{ github.run_attempt }}",
  "if: needs.applicability.outputs.applicable == 'true'",
  "needs: applicability",
  "fail-fast: false",
  "max-parallel: 10",
  "attempt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "name: Flake probe ${{ matrix.attempt }}/10",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\"",
  "2>&1 | tee flake-probe-output.log",
  "run_id=${{ github.run_id }}",
  "run_attempt=${{ github.run_attempt }}",
  "name: flake-probe-result-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.attempt }}",
  "name: flake-probe-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.attempt }}",
  "cp flake-probe-result/result.txt flake-probe-diagnostics/result.txt",
  "cp flake-probe-output.log flake-probe-diagnostics/probe-output.log",
  "name: Report observed probe failure",
  "context_file=\"$(find test-results -name error-context.md -type f -print -quit 2>/dev/null || true)\"",
  "Attempt: ${{ matrix.attempt }}/10",
  "Exact SHA: \\`${PROBE_SHA:-unknown}\\`",
  "Target: \\`${PROBE_TARGET:-unknown}\\`",
  "Actions run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}",
  "Diagnostic artifact: \\`$diagnostic_artifact\\`",
  "uses: actions/upload-artifact@v4",
  "summary:",
  "if: ${{ always() && (needs.applicability.result != 'success' || needs.applicability.outputs.applicable == 'true') }}",
  "name: Flake probe summary",
  "needs: [applicability, probe]",
  "name: Require successful applicability detection",
  "name: Download applicability evidence",
  "name: Download attempt results",
  "pattern: flake-probe-result-${{ github.run_id }}-${{ github.run_attempt }}-*",
  "name: Download failed-attempt diagnostics",
  "if: needs.probe.result != 'success'",
  "pattern: flake-probe-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}-*",
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
  "npm run plasmon:demo:prepare",
  "npm run plasmon:demo:serve > /tmp/plasmon-pocketic.log 2>&1 &",
  "npm run plasmon:demo:status",
  "npm run plasmon:demo:reinstall",
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
  requireFragment(runner, fragment, "flake-probe runner");
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
  "Failure summary",
  "failure occurrence(s)",
  "Unique failing tests parsed",
  "MODIFIED IN PR",
  "UNCHANGED IN PR",
  "attempt(s)",
  "Failed attempts without a parsed test identity",
  "SUMMARY INTEGRITY FAILURE",
  "STABILITY OBSERVED: 10/10 fresh attempts passed.",
  "FLAKE/FAILURE OBSERVED:",
  "process.exitCode = 1",
  "extractFailures",
  "playwrightRunFailure",
  "playwrightDetailFailure",
]) {
  requireFragment(summarizer, fragment, "flake-probe aggregate summarizer");
}

for (const fragment of [
  "--repeat-each",
  "--pass-with-no-tests",
  "paths-ignore",
  "pull_request_target",
  "run: exit 1",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
  forbidFragment(runner, fragment, "flake-probe runner");
}

// Targeted probes deliberately execute the named acceptance even while that
// boundary is quarantined from the normal required Specialist inventory.
forbidFragment(
  runner,
  "--grep-invert @r2-quarantine",
  "targeted flake-probe runner",
);

const attempts = workflow.match(/attempt: \[([^\]]+)\]/)?.[1]
  ?.split(",")
  .map((value) => Number(value.trim()));
if (
  !attempts ||
  attempts.length !== 10 ||
  attempts.some((value, index) => value !== index + 1)
) {
  throw new Error(
    "flake-probe workflow must define exactly ten numbered fresh attempts",
  );
}

const retryZeroCount = runner.split("--retries=0").length - 1;
if (retryZeroCount < 2) {
  throw new Error(
    "flake-probe runner must disable retries for full and targeted probes",
  );
}

const workerOneCount =
  runner.split("--workers=1").length - 1 +
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

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const result = `attempt=${attempt}\noutcome=failure\nsha=fixture-sha\ntarget=all\n`;
      const resultDirectory = join(resultsRoot, `attempt-${attempt}`);
      const diagnosticDirectory = join(
        diagnosticsRoot,
        `flake-probe-diagnostics-fixture-${attempt}`,
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
      "Failure occurrences parsed: 20",
      "Unique failing tests parsed: 2",
      "**(20 failure occurrence(s)) `test/e2e/changed.spec.ts` — MODIFIED IN PR**",
      "`failure one` — 10 occurrence(s), attempt(s) 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
      "`failure two` — 10 occurrence(s), attempt(s) 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
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

verifySummaryParserBehavior();

console.log(
  "Flake-probe always-instantiated required-check, cheap applicability detection, job-level not-applicable skip, ten-fresh-run, exact-head, retry-zero, target-selection, automatic-test-discovery, diagnostic aggregation, failure-identity summary, Playwright failure-only parsing, and changed-file annotation contracts verified",
);
