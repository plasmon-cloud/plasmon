import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureProbe } from "./configure-plasmon-flake-probe.mjs";
import { packetSizeForProbe } from "./build-plasmon-flake-probe-matrix.mjs";
import { browserLanes, optionalCoreBrowserTests } from "./plasmon-test-inventory.mjs";
import {
  PRE_MERGE_CHARACTERIZATION_COUNT,
  PRE_MERGE_PROBE_COUNT,
  POST_MERGE_CHARACTERIZATION_COUNT,
  POST_MERGE_PROBE_COUNT,
} from "./plasmon-flake-probe-policy.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const workflowReadme = readFileSync(".github/workflows/README.md", "utf8");
const probeDoc = readFileSync(".github/workflows/PLASMON_FLAKE_PROBE.md", "utf8");
const stagedDoc = readFileSync(".github/workflows/PLASMON_STAGED_CI.md", "utf8");
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
  "  pull_request_review:",
  "types: [submitted]",
  "  merge_group:",
  "types: [checks_requested]",
  "workflow_dispatch:",
  "pull_request|pull_request_review)",
  "github.event.review.state == 'approved'",
  "name: Detect retained approval",
  "reviewDecision",
  "EFFECTIVE_EVENT_NAME",
  "steps.retained_approval.outputs.approved == 'true'",
  "Report ordinary PR waiting for approval",
  "Report merge queue fast-only checkpoint",
  "name: Flake probe summary",
  "name: Flake characterization summary",
  "summarize-plasmon-flake-evidence.mjs",
  "if: ${{ needs.applicability.outputs.applicable == 'true' }}",
  "if: ${{ needs.applicability.outputs.characterization_applicable == 'true' }}",
  "set -o pipefail",
  "continue-on-error: ${{ github.event_name == 'push' && matrix.mode == 'characterization' }}",
]) requireFragment(workflow, fragment, "Flake Probe workflow");
for (const fragment of [
  "pull_request_target",
  "--repeat-each",
  "deferred to merge queue",
  "Require approved pre-merge probe matrix success",
]) forbidFragment(workflow, fragment, "Flake Probe workflow");

for (const fragment of ["ci:flake-probe", "createWorkflowDispatch", "workflow_id: 'plasmon-flake-probe.yml'"]) requireFragment(labelWorkflow, fragment, "explicit Flake Probe label bridge");
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine", "exact-set)"]) requireFragment(runner, fragment, "flake executable runner");

const ordinaryPlaywright = browserLanes.specialist[0];
const profileSpecificPlaywright = optionalCoreBrowserTests.find((path) => !browserLanes.specialist.includes(path));
if (!ordinaryPlaywright || !profileSpecificPlaywright) throw new Error("shared browser inventory lacks representative ordinary/profile-specific acceptance");

const reviewHead = await configureProbe({ eventName: "pull_request", changedFiles: [ordinaryPlaywright] });
if (reviewHead.applicable || reviewHead.phase !== "pr-review" || reviewHead.characterization.applicable) throw new Error("ordinary PR heads must wait for approval without probe execution");

const approved = await configureProbe({ eventName: "pull_request_review", changedFiles: [ordinaryPlaywright] });
if (!approved.applicable || approved.phase !== "pre-merge-confidence" || approved.primary.iteration_count !== PRE_MERGE_PROBE_COUNT) throw new Error("approved review lost required broad confidence probe");
if (!approved.characterization.applicable || approved.characterization.iteration_count !== PRE_MERGE_CHARACTERIZATION_COUNT || approved.characterization.profile !== "local") throw new Error("approved Playwright impact must select 3x local characterization");

const profileApproved = await configureProbe({ eventName: "pull_request_review", changedFiles: [profileSpecificPlaywright] });
if (!profileApproved.characterization.applicable || profileApproved.characterization.profile !== "demo" || !profileApproved.characterization.files.includes(profileSpecificPlaywright)) throw new Error("profile-only approved impact must use truthful demo characterization");

const merge = await configureProbe({ eventName: "merge_group", changedFiles: [ordinaryPlaywright] });
if (merge.applicable || merge.phase !== "merge-queue" || merge.characterization.applicable) throw new Error("merge queue must not repeat browser flake probing");

const postMerge = await configureProbe({ eventName: "push", changedFiles: [ordinaryPlaywright] });
if (!postMerge.applicable || postMerge.phase !== "post-merge" || postMerge.primary.iteration_count !== POST_MERGE_PROBE_COUNT) throw new Error("integrated release push lost 3-observation broad policy");
if (!postMerge.characterization.applicable || postMerge.characterization.iteration_count !== POST_MERGE_CHARACTERIZATION_COUNT) throw new Error("integrated Playwright impact lost 3x targeted post-merge policy");

if (packetSizeForProbe({ iteration_count: PRE_MERGE_CHARACTERIZATION_COUNT, target: "exact-set", mode: "characterization" }) !== PRE_MERGE_CHARACTERIZATION_COUNT) throw new Error("pre-merge 3x characterization must use one prepared packet");
if (packetSizeForProbe({ iteration_count: POST_MERGE_CHARACTERIZATION_COUNT, target: "exact-set", mode: "characterization" }) !== POST_MERGE_CHARACTERIZATION_COUNT) throw new Error("post-merge targeted 3x characterization must use one prepared packet");
if (packetSizeForProbe({ iteration_count: POST_MERGE_PROBE_COUNT, target: "all", mode: "baseline" }) !== 1) throw new Error("broad post-merge observations remain independent setups until the PocketIC optimization proves reuse safe");

const unrelated = await configureProbe({ eventName: "pull_request_review", changedFiles: ["README.md"] });
if (unrelated.characterization.applicable) throw new Error("non-Playwright changes must not receive automatic targeted characterization");

function writeResult(root, iteration, count, { mode, outcome = "success", runAttempt = 1 } = {}) {
  const directory = join(root, `attempt-${runAttempt}-iteration-${iteration}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "result.txt"), [
    "run_id=fixture", "run_number=900", `run_attempt=${runAttempt}`, `mode=${mode}`, `iteration=${iteration}`,
    `iteration_count=${count}`, `outcome=${outcome}`, "sha=fixture-sha",
    `target=${mode === "characterization" ? "exact-set" : "all"}`,
    `scope=${mode === "characterization" ? "characterization:local:fixture" : "all"}`,
    "test_file=", "test_grep=", "test_files_json=[]", "",
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
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

verifySummaryFixture({ count: PRE_MERGE_PROBE_COUNT, mode: "merge-validation" });
verifySummaryFixture({ count: POST_MERGE_PROBE_COUNT, mode: "baseline" });
verifySummaryFixture({ count: PRE_MERGE_CHARACTERIZATION_COUNT, mode: "characterization" });
verifySummaryFixture({ count: POST_MERGE_PROBE_COUNT, mode: "merge-validation", shouldPass: false });

for (const fragment of [
  "Reviewer approves",
  "Merge queue",
  "fast-only",
  "3 broad",
  "3 targeted",
  "ci:flake-probe",
  "@quarantine",
]) requireFragment(`${workflowReadme}\n${probeDoc}\n${stagedDoc}`, fragment, "durable CI documentation");

console.log("Flake Probe scheduling verified: PR waits for approval, approval and retained approved heads run 1 broad + conditional 3 targeted as a hard gate, merge queue repeats no browser probe, post-merge runs 3 broad + conditional 3 targeted, and every applicable probe summary aggregates its evidence before propagating the aggregate result");
