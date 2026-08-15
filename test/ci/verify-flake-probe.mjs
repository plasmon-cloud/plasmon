import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";

const workflow = readFileSync(workflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");

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
  "cancel-in-progress: true",
  "fail-fast: false",
  "max-parallel: 10",
  "attempt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  "name: Flake probe ${{ matrix.attempt }}/10",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "continue-on-error: true",
  "bash test/ci/run-plasmon-flake-probe.sh \"$PROBE_TARGET\"",
  "uses: actions/upload-artifact@v4",
  "uses: actions/download-artifact@v4",
  "Fresh attempts reported: $total/10",
  "First-attempt passes: $passed/10",
  "if [ \"$total\" -ne 10 ] || [ \"$passed\" -ne 10 ]; then",
];
for (const fragment of workflowFragments) {
  requireFragment(workflow, fragment, "flake-probe workflow");
}

const runnerFragments = [
  "npm ci",
  "npm run plasmon:demo:prepare",
  "npm run plasmon:demo:serve > /tmp/plasmon-pocketic.log 2>&1 &",
  "npm run plasmon:demo:status",
  "npm run plasmon:demo:reinstall",
  "--workers=1",
  "--retries=0",
  "--grep-invert @r2-quarantine",
  "npm run test:e2e:plasmon:specialist -- --retries=0",
  "test/e2e/plasmon-golden-path-right-snap.spec.ts",
  "test/e2e/plasmon-golden-path-left-snap.spec.ts",
  "test/e2e/plasmon-golden-path-window-lifetime.spec.ts",
  "test/e2e/plasmon-monaco-packaged.spec.ts",
  "test/e2e/plasmon-emulatorjs-proof.spec.ts",
];
for (const fragment of runnerFragments) {
  requireFragment(runner, fragment, "flake-probe runner");
}

for (const fragment of [
  "--repeat-each",
  "git diff --name-only",
  "pull_request.paths",
  "paths-ignore",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
  forbidFragment(runner, fragment, "flake-probe runner");
}

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

console.log("Flake-probe label, ten-fresh-run, exact-head, retry-zero, and aggregate-summary contracts verified");
