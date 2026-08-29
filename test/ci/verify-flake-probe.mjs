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
import { selectPhaseCharacterization } from "./select-plasmon-flake-characterization-phase.mjs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const workflow = readFileSync(workflowPath, "utf8");
const labelWorkflow = readFileSync(".github/workflows/plasmon-flake-probe-label.yml", "utf8");
const runner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");
const summarizerPath = "test/ci/summarize-staged-flake-probe.mjs";

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}

for (const fragment of [
  "name: Plasmon Flake Probe",
  "  push:",
  "      - 'release/**'",
  "  pull_request:",
  "types: [opened, synchronize, reopened]",
  "  merge_group:",
  "types: [checks_requested]",
  "workflow_dispatch:",
  "github.event.merge_group.head_sha",
  "github.event.after",
  "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  "phase=pr-review",
  "reason=deferred-to-merge-queue",
  "phase=merge-queue",
  "reason=merge-group-validation",
  "phase=post-merge",
  "reason=integrated-release-push",
  "primary_mode=merge-validation",
  "iteration_count=1",
  "primary_mode=baseline",
  "iteration_count=10",
  "1|10|50",
  "characterization_count=10",
  "characterization_count=50",
  "select-plasmon-flake-characterization-phase.mjs",
  "name: Flake probe summary",
  "Report PR flake gate deferred to merge queue",
  "name: Flake characterization summary",
  "Report PR characterization deferred to merge queue",
  "summarize-staged-flake-probe.mjs",
  "continue-on-error: ${{ matrix.mode == 'characterization' }}",
  "max-parallel: 10",
]) requireFragment(workflow, fragment, "staged Flake Probe workflow");

for (const fragment of ["pull_request_target", "--repeat-each", "cancel-in-progress: true\n\njobs:"]) {
  forbidFragment(workflow, fragment, "staged Flake Probe workflow");
}

for (const fragment of ["ci:flake-probe", "createWorkflowDispatch", "workflow_id: 'plasmon-flake-probe.yml'"]) {
  requireFragment(labelWorkflow, fragment, "explicit Flake Probe label bridge");
}
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine", "exact-set)", "--grep @saved-preview"]) {
  requireFragment(runner, fragment, "flake executable runner");
}

async function verifySelection() {
  const ordinary = "test/e2e/plasmon-golden-path-left-snap.spec.ts";
  const profile = "test/e2e/plasmon-demo-native-app-chrome.spec.ts";

  const mergeOrdinary = await selectPhaseCharacterization({ changedFiles: [ordinary], iterations: 10 });
  if (!mergeOrdinary.applicable || mergeOrdinary.iteration_count !== 10 || mergeOrdinary.profile !== "local" || mergeOrdinary.files?.[0] !== ordinary) {
    throw new Error("merge-queue ordinary Playwright change must select exact local scope for 10 repetitions");
  }

  const postOrdinary = await selectPhaseCharacterization({ changedFiles: [ordinary], iterations: 50 });
  if (!postOrdinary.applicable || postOrdinary.iteration_count !== 50 || postOrdinary.profile !== "local") {
    throw new Error("post-merge ordinary Playwright change must select local scope for 50 repetitions");
  }

  const profileOnly = await selectPhaseCharacterization({ changedFiles: [profile], iterations: 10 });
  if (!profileOnly.applicable || profileOnly.profile !== "demo" || profileOnly.iteration_count !== 10 || !profileOnly.files.includes(profile)) {
    throw new Error("profile-only Playwright change must be characterized against the demo/full profile, not silently deferred forever");
  }

  const mixed = await selectPhaseCharacterization({ changedFiles: [ordinary, profile], iterations: 10 });
  if (!mixed.applicable || mixed.profile !== "local" || !mixed.files.includes(ordinary) || mixed.files.includes(profile) || !mixed.deferred_profile_tests.includes(profile)) {
    throw new Error("mixed-profile change must characterize the truthful ordinary scope and retain profile-specific deferral instead of running it against local");
  }

  const unrelated = await selectPhaseCharacterization({ changedFiles: ["README.md"], iterations: 10 });
  if (unrelated.applicable) throw new Error("non-Playwright changes must not receive automatic targeted characterization");
}

function writeResult(root, iteration, count, { mode, outcome = "success", runAttempt = 1 } = {}) {
  const directory = join(root, `attempt-${runAttempt}-iteration-${iteration}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "result.txt"), [
    "run_id=fixture",
    "run_number=900",
    `run_attempt=${runAttempt}`,
    `mode=${mode}`,
    `iteration=${iteration}`,
    `iteration_count=${count}`,
    `outcome=${outcome}`,
    "sha=fixture-sha",
    `target=${mode === "characterization" ? "exact-set" : "all"}`,
    `scope=${mode === "characterization" ? "characterization:local:fixture" : "all"}`,
    "test_file=",
    "test_grep=",
    "test_files_json=[]",
    "",
  ].join("\n"));
}

function verifySummaryFixture({ count, mode, shouldPass = true }) {
  const root = mkdtempSync(join(tmpdir(), `plasmon-staged-flake-${mode}-${count}-`));
  try {
    const results = join(root, "results");
    const diagnostics = join(root, "diagnostics");
    const changed = join(root, "changed.txt");
    const json = join(root, "summary.json");
    mkdirSync(results, { recursive: true });
    mkdirSync(diagnostics, { recursive: true });
    writeFileSync(changed, "test/e2e/changed.spec.ts\n");
    for (let iteration = 1; iteration <= count; iteration += 1) writeResult(results, iteration, count, { mode });
    const run = spawnSync(process.execPath, [summarizerPath, results, diagnostics, changed, "--json-file", json], { encoding: "utf8" });
    if ((run.status === 0) !== shouldPass) throw new Error(`${mode}/${count} staged summary unexpected exit ${run.status}: ${run.stdout}\n${run.stderr}`);
    if (shouldPass) {
      requireFragment(run.stdout, `Configured probe iterations: ${count}`, `${mode}/${count} summary`);
      requireFragment(run.stdout, `Fresh probe iterations reported: ${count}/${count}`, `${mode}/${count} summary`);
      const packet = JSON.parse(readFileSync(json, "utf8")).evidence_packets?.[0];
      if (packet?.mode !== mode || packet?.iteration_count !== count || packet?.sha !== "fixture-sha") {
        throw new Error(`${mode}/${count} summary lost exact packet identity`);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await verifySelection();
verifySummaryFixture({ count: 1, mode: "merge-validation" });
verifySummaryFixture({ count: 10, mode: "baseline" });
verifySummaryFixture({ count: 10, mode: "characterization" });
verifySummaryFixture({ count: 50, mode: "characterization" });
verifySummaryFixture({ count: 10, mode: "merge-validation", shouldPass: false });

console.log("Staged Flake Probe verified: ordinary PR deferral, merge_group 1+conditional-10 policy, post-merge 10+conditional-50 policy, exact profile-aware targeting, explicit diagnostic label path, retry-free quarantine-safe execution, and phase/count summary integrity");
