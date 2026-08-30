import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureProbe } from "./configure-plasmon-flake-probe.mjs";
import { browserLanes, optionalCoreBrowserTests } from "./plasmon-test-inventory.mjs";
import {
  MERGE_QUEUE_CHARACTERIZATION_COUNT,
  MERGE_QUEUE_PROBE_COUNT,
  POST_MERGE_CHARACTERIZATION_COUNT,
  POST_MERGE_PROBE_COUNT,
} from "./plasmon-flake-probe-policy.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const workflowReadme = readFileSync(".github/workflows/README.md", "utf8");
const probeDoc = readFileSync(".github/workflows/PLASMON_FLAKE_PROBE.md", "utf8");
const labelWorkflow = readFileSync(".github/workflows/plasmon-flake-probe-label.yml", "utf8");
const runner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");
const summarizerPath = "test/ci/summarize-plasmon-flake-evidence.mjs";

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
  "Record changed files for this phase",
  "configure-plasmon-flake-probe.mjs",
  "Build probe matrix",
  "name: Flake probe summary",
  "Report PR flake gate deferred to merge queue",
  "name: Flake characterization summary",
  "Report PR characterization deferred to merge queue",
  "summarize-plasmon-flake-evidence.mjs",
  "continue-on-error: ${{ matrix.mode == 'characterization' }}",
  "max-parallel: 10",
]) requireFragment(workflow, fragment, "Flake Probe workflow");
for (const fragment of ["pull_request_target", "--repeat-each", "select-plasmon-flake-characterization-phase.mjs", "summarize-staged-flake-probe.mjs"]) {
  forbidFragment(workflow, fragment, "Flake Probe workflow");
}

for (const fragment of ["ci:flake-probe", "createWorkflowDispatch", "workflow_id: 'plasmon-flake-probe.yml'"]) {
  requireFragment(labelWorkflow, fragment, "explicit Flake Probe label bridge");
}
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine", "exact-set)", "--grep @saved-preview"]) {
  requireFragment(runner, fragment, "flake executable runner");
}

const ordinaryPlaywright = browserLanes.specialist[0];
const profileSpecificPlaywright = optionalCoreBrowserTests.find((path) => !browserLanes.specialist.includes(path));
if (!ordinaryPlaywright || !profileSpecificPlaywright) throw new Error("shared browser inventory lacks representative ordinary/profile-specific acceptance");

const review = await configureProbe({ eventName: "pull_request", changedFiles: [ordinaryPlaywright] });
if (review.applicable || review.phase !== "pr-review" || review.primary.iteration_count !== MERGE_QUEUE_PROBE_COUNT || review.characterization.applicable) {
  throw new Error("ordinary PR heads must defer Flake Probe execution to merge queue");
}

const merge = await configureProbe({ eventName: "merge_group", changedFiles: [ordinaryPlaywright] });
if (!merge.applicable || merge.phase !== "merge-queue" || merge.primary.iteration_count !== MERGE_QUEUE_PROBE_COUNT) {
  throw new Error("merge-group validation lost its required broad probe policy");
}
if (!merge.characterization.applicable || merge.characterization.iteration_count !== MERGE_QUEUE_CHARACTERIZATION_COUNT || merge.characterization.profile !== "local") {
  throw new Error("merge-group ordinary Playwright impact must select local targeted characterization");
}

const profileMerge = await configureProbe({ eventName: "merge_group", changedFiles: [profileSpecificPlaywright] });
if (!profileMerge.characterization.applicable || profileMerge.characterization.profile !== "demo" || !profileMerge.characterization.files.includes(profileSpecificPlaywright)) {
  throw new Error("profile-only Playwright impact must use the truthful demo/full-profile characterization environment");
}

const postMerge = await configureProbe({ eventName: "push", changedFiles: [ordinaryPlaywright] });
if (!postMerge.applicable || postMerge.phase !== "post-merge" || postMerge.primary.iteration_count !== POST_MERGE_PROBE_COUNT) {
  throw new Error("integrated release push lost post-merge broad stability policy");
}
if (!postMerge.characterization.applicable || postMerge.characterization.iteration_count !== POST_MERGE_CHARACTERIZATION_COUNT) {
  throw new Error("integrated Playwright impact lost post-merge characterization policy");
}

const unrelated = await configureProbe({ eventName: "merge_group", changedFiles: ["README.md"] });
if (unrelated.characterization.applicable) throw new Error("non-Playwright changes must not receive automatic targeted characterization");

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
  const root = mkdtempSync(join(tmpdir(), `plasmon-flake-${mode}-${count}-`));
  try {
    const results = join(root, "results");
    const diagnostics = join(root, "diagnostics");
    const changed = join(root, "changed.txt");
    const json = join(root, "summary.json");
    mkdirSync(results, { recursive: true });
    mkdirSync(diagnostics, { recursive: true });
    writeFileSync(changed, `${ordinaryPlaywright}\n`);
    for (let iteration = 1; iteration <= count; iteration += 1) writeResult(results, iteration, count, { mode });
    const run = spawnSync(process.execPath, [summarizerPath, results, diagnostics, changed, "--json-file", json], { encoding: "utf8" });
    if ((run.status === 0) !== shouldPass) throw new Error(`${mode}/${count} summary unexpected exit ${run.status}: ${run.stdout}\n${run.stderr}`);
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

verifySummaryFixture({ count: MERGE_QUEUE_PROBE_COUNT, mode: "merge-validation" });
verifySummaryFixture({ count: POST_MERGE_PROBE_COUNT, mode: "baseline" });
verifySummaryFixture({ count: MERGE_QUEUE_CHARACTERIZATION_COUNT, mode: "characterization" });
verifySummaryFixture({ count: POST_MERGE_CHARACTERIZATION_COUNT, mode: "characterization" });
verifySummaryFixture({ count: POST_MERGE_PROBE_COUNT, mode: "merge-validation", shouldPass: false });

for (const fragment of [
  "### Pull-request head: review readiness",
  "### Merge queue: required pre-merge validation",
  "### Integrated release branch: post-merge stability evidence",
  "ci:flake-probe",
  "@quarantine",
]) requireFragment(`${workflowReadme}\n${probeDoc}`, fragment, "durable CI documentation");
const retiredProvenanceFragments = [
  ["Issue", "#594"].join(" "),
  ["R3", "staged"].join(" "),
  ["release", "0.1.0-r3"].join("/"),
];
for (const fragment of retiredProvenanceFragments) {
  forbidFragment(`${workflowReadme}\n${probeDoc}`, fragment, "durable CI documentation");
}

console.log("Flake Probe scheduling verified from shared policy: PR deferral, merge-group 1+conditional-10 validation, post-merge 10+conditional-50 stability analysis, profile-aware targeting, explicit heavy diagnostics, retry-free quarantine-safe execution, and phase/count summary integrity");
