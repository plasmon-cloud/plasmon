import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const labelWorkflowPath = ".github/workflows/plasmon-flake-probe-label.yml";
const fastWorkflowPath = ".github/workflows/plasmon-ci.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const fastRunnerPath = "test/ci/run-plasmon-fast-tests.sh";
const specialistRunnerPath = "test/ci/run-plasmon-specialist.mjs";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
const labelWorkflow = readFileSync(labelWorkflowPath, "utf8");
const fastWorkflow = readFileSync(fastWorkflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const fastRunner = readFileSync(fastRunnerPath, "utf8");
const specialistRunner = readFileSync(specialistRunnerPath, "utf8");
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
  "paths:",
  "apps/plasmon/test/**",
  "test/e2e/**",
  "test/ci/**",
  "workflow_dispatch:",
  "group: plasmon-flake-probe-${{ github.event.pull_request.number || github.ref }}",
  "cancel-in-progress: true",
  "fail-fast: false",
  "max-parallel: 10",
  "attempt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "name: Flake probe ${{ matrix.attempt }}/10",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "continue-on-error: true",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\"",
  "run_id=${{ github.run_id }}",
  "run_attempt=${{ github.run_attempt }}",
  "name: flake-probe-result-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.attempt }}",
  "name: flake-probe-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.attempt }}",
  "cp flake-probe-result/result.txt flake-probe-diagnostics/result.txt",
  "name: Report observed probe failure",
  "context_file=\"$(find test-results -name error-context.md -type f -print -quit 2>/dev/null || true)\"",
  "Attempt: ${{ matrix.attempt }}/10",
  "Exact SHA: \\`${PROBE_SHA:-unknown}\\`",
  "Target: \\`${PROBE_TARGET:-unknown}\\`",
  "Actions run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}",
  "Diagnostic artifact: \\`$diagnostic_artifact\\`",
  "sed -n '1,120p' \"$context_file\"",
  "diagnostics are available in artifact",
  "uses: actions/upload-artifact@v4",
  "uses: actions/download-artifact@v4",
  "pattern: flake-probe-result-${{ github.run_id }}-${{ github.run_attempt }}-*",
  "declare -A seen_attempts=()",
  "declare -A seen_shas=()",
  "declare -A seen_targets=()",
  "Fresh attempts reported: $total/10",
  "First-attempt passes: $passed/10",
  "STABILITY OBSERVED: 10/10 fresh attempts passed.",
  "FLAKE/FAILURE OBSERVED:",
  "} | tee -a \"$GITHUB_STEP_SUMMARY\"",
  "if [ \"$passed\" -ne 10 ]; then",
];
for (const fragment of workflowFragments) {
  requireFragment(workflow, fragment, "flake-probe workflow");
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
  requireFragment(workflow, `          - ${option}`, "flake-probe dispatch target choices");
}

const runnerFragments = [
  "npm ci",
  "all)",
  "node test/ci/verify-flake-probe.mjs",
  "node test/ci/verify-plasmon-test-inventory.mjs",
  "bash test/ci/run-plasmon-fast-tests.sh",
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

requireFragment(fastWorkflow, "bash test/ci/run-plasmon-fast-tests.sh", "required Fast CI workflow");
for (const fragment of [
  "PLASMON_FAST_TEST_TIMEOUT_SECONDS:-60",
  "timeout --signal=TERM --kill-after=5s \"${timeout_seconds}s\"",
  "npm --workspace neutron-plasmon test",
  "status=$?",
  "[ \"$status\" -eq 124 ]",
  "Fast Bun tests exceeded ${timeout_seconds} seconds",
  "exit 124",
]) {
  requireFragment(fastRunner, fragment, "bounded fast-test runner");
}
forbidFragment(runner, "npm --workspace neutron-plasmon test", "flake-probe runner");

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string") {
  throw new Error("package.json lost test:e2e:plasmon:specialist");
}
requireFragment(specialistScript, "test/ci/run-plasmon-specialist.mjs", "required Specialist npm script");
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
  "--repeat-each",
  "--pass-with-no-tests",
  "git diff --name-only",
  "paths-ignore",
  "pull_request_target",
  "run: exit 1",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
  forbidFragment(runner, fragment, "flake-probe runner");
}

// Targeted probes deliberately execute the named acceptance even while that
// boundary is quarantined from the normal required Specialist inventory.
forbidFragment(runner, "--grep-invert @r2-quarantine", "targeted flake-probe runner");

const attempts = workflow.match(/attempt: \[([^\]]+)\]/)?.[1]
  ?.split(",")
  .map((value) => Number(value.trim()));
if (!attempts || attempts.length !== 10 || attempts.some((value, index) => value !== index + 1)) {
  throw new Error("flake-probe workflow must define exactly ten numbered fresh attempts");
}

const retryZeroCount = runner.split("--retries=0").length - 1;
if (retryZeroCount < 2) {
  throw new Error("flake-probe runner must disable retries for full and targeted probes");
}

const workerOneCount =
  runner.split("--workers=1").length - 1 +
  specialistRunner.split("--workers=1").length - 1;
if (workerOneCount < 2 || !specialistRunner.includes("--workers=1")) {
  throw new Error("flake-probe runner must serialize both targeted and Specialist probes");
}

console.log("Flake-probe path-trigger, ten-fresh-run, exact-head, retry-zero, target-selection, automatic-test-discovery, artifact-identity, failure-reporting, bounded-fast-test, and aggregate-summary contracts verified");
