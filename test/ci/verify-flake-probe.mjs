import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
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
  "types: [labeled, synchronize, reopened]",
  "workflow_dispatch:",
  "contains(github.event.pull_request.labels.*.name, 'ci:flake-probe')",
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

for (const option of [
  "specialist",
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
]) {
  requireFragment(workflow, `          - ${option}`, "flake-probe dispatch target choices");
}

const runnerFragments = [
  "npm ci",
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
];
for (const fragment of runnerFragments) {
  requireFragment(runner, fragment, "flake-probe runner");
}

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string") {
  throw new Error("package.json lost test:e2e:plasmon:specialist");
}
for (const fragment of ["--workers=1", "--grep-invert @r2-quarantine"]) {
  requireFragment(specialistScript, fragment, "required Specialist npm script");
}

for (const fragment of [
  "--repeat-each",
  "--pass-with-no-tests",
  "git diff --name-only",
  "pull_request.paths",
  "paths-ignore",
  "pull_request_target",
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

const workerOneCount = runner.split("--workers=1").length - 1;
if (workerOneCount < 1 || !specialistScript.includes("--workers=1")) {
  throw new Error("flake-probe runner must serialize both targeted and Specialist probes");
}

console.log("Flake-probe label, ten-fresh-run, exact-head, retry-zero, target-selection, artifact-identity, and aggregate-summary contracts verified");
