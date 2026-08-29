import { readFileSync } from "node:fs";
import { selectLabeledProbe } from "./select-labeled-flake-probe.mjs";

const labelWorkflow = readFileSync(
  ".github/workflows/plasmon-flake-probe-label.yml",
  "utf8",
);
const probeDoc = readFileSync(
  ".github/workflows/PLASMON_FLAKE_PROBE.md",
  "utf8",
);
const workflowReadme = readFileSync(".github/workflows/README.md", "utf8");
const labeledSelector = readFileSync(
  "test/ci/select-labeled-flake-probe.mjs",
  "utf8",
);
const probeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

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

for (const fragment of [
  "name: Plasmon Flake Probe Label Trigger",
  "types: [labeled, synchronize]",
  "actions: write",
  "pull-requests: read",
  "github.event.label.name == 'ci:flake-probe'",
  "contains(github.event.pull_request.labels.*.name, 'ci:flake-probe')",
  "HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}",
  "release/0.1.0-r2",
  "name: Checkout exact PR head for target selection",
  "ref: ${{ github.event.pull_request.head.sha }}",
  "git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\"",
  "node test/ci/select-labeled-flake-probe.mjs",
  "name: Require an unambiguous direct target",
  "Flake-Probe-Target: test/e2e/<file>.spec.ts",
  "Quarantined acceptances remain excluded even for labeled probes.",
  "name: Dispatch fresh exact-head 50-iteration probe",
  "createWorkflowDispatch",
  "workflow_id: 'plasmon-flake-probe.yml'",
  "const headSha = pullRequest.head.sha;",
  "const dispatchRef = pullRequest.head.ref;",
  "ref: headSha,",
  "iterations: '50'",
  "target: selectedTarget",
  "ref: dispatchRef",
  "inputs.test_file = selectedTestFile",
  "inputs.test_grep = selectedTestGrep",
  "Quarantine: always excluded",
  "--workers=1 --retries=0 --grep-invert @quarantine",
]) {
  requireFragment(labelWorkflow, fragment, "flake-probe label bridge");
}
for (const fragment of [
  "target: 'all'",
  "target: 'specialist'",
  "pull_request_target",
  "include_quarantined",
  "--retries=1",
]) {
  forbidFragment(labelWorkflow, fragment, "flake-probe label bridge");
}

for (const fragment of [
  "Flake-Probe-Target",
  "Flake-Probe-Grep",
  "namedDirectTargets",
  "targetDirective === \"all\" || targetDirective === \"specialist\"",
  "selectCharacterization",
  "automatic.files.length !== 1",
  "explicit-target-required",
  "iterations: 50",
  "quarantine_excluded: true",
  "target: \"exact\"",
]) {
  requireFragment(labeledSelector, fragment, "labeled target selector");
}
for (const fragment of ["include_quarantined: true", "shared-support-fallback"]) {
  forbidFragment(labeledSelector, fragment, "labeled target selector");
}

for (const fragment of [
  "--workers=1",
  "--retries=0",
  "--grep-invert @quarantine",
]) {
  requireFragment(probeRunner, fragment, "flake-probe runner quarantine boundary");
}

for (const fragment of [
  "ci:flake-probe",
  "50-iteration",
  "Flake-Probe-Target:",
  "Flake-Probe-Grep:",
  "quarantine",
]) {
  requireFragment(
    `${workflowReadme}\n${probeDoc}`,
    fragment,
    "flake-probe labeled-probe documentation",
  );
}

const explicit = await selectLabeledProbe({
  body: [
    "Flake-Probe-Target: test/e2e/plasmon-golden-path-left-snap.spec.ts",
    "Flake-Probe-Grep: @issue-277",
  ].join("\n"),
  changedFiles: [],
});
if (
  !explicit.dispatch ||
  explicit.iterations !== 50 ||
  explicit.target !== "exact" ||
  explicit.test_file !== "test/e2e/plasmon-golden-path-left-snap.spec.ts" ||
  explicit.test_grep !== "@issue-277" ||
  explicit.quarantine_excluded !== true
) {
  throw new Error("explicit labeled target must remain a direct 50-iteration probe with quarantine excluded");
}

const named = await selectLabeledProbe({
  body: "Flake-Probe-Target: saved-preview",
  changedFiles: [],
});
if (
  !named.dispatch ||
  named.iterations !== 50 ||
  named.target !== "saved-preview" ||
  named.quarantine_excluded !== true
) {
  throw new Error("supported named label target must preserve quarantine exclusion");
}

const inferred = await selectLabeledProbe({
  body: "",
  changedFiles: ["test/e2e/plasmon-neutron-icon.spec.ts"],
});
if (
  !inferred.dispatch ||
  inferred.iterations !== 50 ||
  inferred.target !== "exact" ||
  inferred.test_file !== "test/e2e/plasmon-neutron-icon.spec.ts" ||
  inferred.quarantine_excluded !== true
) {
  throw new Error("one changed non-quarantined Playwright file must be inferable for a labeled probe");
}

for (const changedFiles of [
  ["playwright.config.ts"],
  ["test/e2e/permission-dialog.fixture.tsx"],
]) {
  const unresolved = await selectLabeledProbe({ body: "", changedFiles });
  if (
    unresolved.dispatch ||
    !unresolved.reason.startsWith("explicit-target-required:")
  ) {
    throw new Error(
      `unresolved support must fail closed for labeled probing: ${changedFiles.join(",")}`,
    );
  }
}

for (const broadTarget of ["all", "specialist"]) {
  let rejected = false;
  try {
    await selectLabeledProbe({
      body: `Flake-Probe-Target: ${broadTarget}`,
      changedFiles: [],
    });
  } catch (error) {
    rejected = String(error?.message ?? error).includes("not allowed for ci:flake-probe");
  }
  if (!rejected) {
    throw new Error(`labeled selector must reject broad target ${broadTarget}`);
  }
}

console.log(
  "Labeled 50-iteration exact-head dispatch, branch-transport/SHA-pin semantics, absolute quarantine exclusion, single-file inference, unresolved-helper fail-closed behavior, broad-target rejection, and label synchronize/removal contract verified",
);
