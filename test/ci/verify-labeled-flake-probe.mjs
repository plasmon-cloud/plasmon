import { readFileSync } from "node:fs";
import { plasmonBranchRole } from "./plasmon-ci-policy.mjs";
import { selectLabeledProbe } from "./select-labeled-flake-probe.mjs";

const labelWorkflow = readFileSync(".github/workflows/plasmon-flake-probe-label.yml", "utf8");
const probeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}

for (const fragment of [
  "name: Plasmon Flake Probe Label Trigger",
  "types: [labeled, synchronize]",
  "ci:flake-probe",
  "actions: write",
  "pull-requests: read",
  "name: Check release integration scope",
  "release/*) ;;",
  "same-repository PR",
  "name: Checkout exact PR head for target selection",
  "ref: ${{ github.event.pull_request.head.sha }}",
  "git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\"",
  "node test/ci/select-labeled-flake-probe.mjs",
  "name: Dispatch fresh exact-head 50-iteration probe",
  "createWorkflowDispatch",
  "workflow_id: 'plasmon-flake-probe.yml'",
  "iterations: '50'",
]) requireFragment(labelWorkflow, fragment, "flake-probe label bridge");
for (const fragment of ["pull_request_target", "target: 'all'", "target: 'specialist'", "include_quarantined"]) {
  forbidFragment(labelWorkflow, fragment, "flake-probe label bridge");
}
for (const ref of ["release/candidate", "release/demo", "release/future"]) {
  if (plasmonBranchRole(ref) !== "release") throw new Error(`release-role policy rejected ${ref}`);
}
for (const ref of ["main", "feature/probe", "release/", "release/future/candidate"]) {
  if (plasmonBranchRole(ref) !== "unknown") throw new Error(`release-role policy accepted invalid ref ${ref}`);
}
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine"]) {
  requireFragment(probeRunner, fragment, "flake-probe runner quarantine boundary");
}

const exactFile = "test/e2e/plasmon-golden-path-left-snap.spec.ts";
const inferredFile = "test/e2e/plasmon-golden-path-right-snap.spec.ts";
const explicit = await selectLabeledProbe({
  body: [`Flake-Probe-Target: ${exactFile}`, "Flake-Probe-Grep: @left-snap"].join("\n"),
  changedFiles: [],
});
if (!explicit.dispatch || explicit.iterations !== 50 || explicit.target !== "exact" || explicit.test_file !== exactFile || explicit.test_grep !== "@left-snap" || explicit.quarantine_excluded !== true) {
  throw new Error("explicit labeled target must remain a direct exact-head 50-iteration probe with quarantine excluded");
}

const inferred = await selectLabeledProbe({ body: "", changedFiles: [inferredFile] });
if (!inferred.dispatch || inferred.iterations !== 50 || inferred.target !== "exact" || inferred.test_file !== inferredFile || inferred.quarantine_excluded !== true) {
  throw new Error("one changed ordinary Playwright file must be inferable for a labeled heavy probe");
}

for (const broad of ["all", "specialist"]) {
  let rejected = false;
  try {
    await selectLabeledProbe({ body: `Flake-Probe-Target: ${broad}`, changedFiles: [] });
  } catch (error) {
    rejected = String(error?.message ?? error).includes("not allowed for ci:flake-probe");
  }
  if (!rejected) throw new Error(`labeled selector must reject broad target ${broad}`);
}

console.log("Labeled Flake Probe verified: release-role/same-repository bridge, exact-head 50-iteration diagnostic dispatch, current behavioral-file inference, retries=0, and quarantine exclusion remain intact independently of staged automatic CI");
