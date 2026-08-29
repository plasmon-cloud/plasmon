import { readFileSync } from "node:fs";
import { releaseBranchGlob } from "./plasmon-ci-policy.mjs";

const RELEASE_BRANCH_TRIGGER = `      - '${releaseBranchGlob}'`;
const MERGE_GROUP_TRIGGER = "  merge_group:";
const CHECKS_REQUESTED_TRIGGER = "    types: [checks_requested]";
const PR_ONLY = "if: ${{ github.event_name == 'pull_request' }}";
const NOT_PR = "if: ${{ github.event_name != 'pull_request' }}";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    expensiveStep: "Package and run Plasmon refactor smoke",
    requiredCommands: [
      "npm ci",
      "node test/ci/verify-playwright-gate.mjs",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:smoke",
    ],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    expensiveStep: "Package and run Plasmon specialist browser acceptance",
    requiredCommands: [
      "npm ci",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:specialist",
    ],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    expensiveStep: "Package and run browser persistence gate",
    requiredCommands: [
      "npm ci",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:persistence",
    ],
  },
];

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

function stepSection(source, stepName) {
  const marker = `      - name: ${stepName}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing workflow step ${stepName}`);
  const next = source.indexOf("\n      - name:", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function verifyCommonTriggers(source, label) {
  for (const fragment of [
    "  pull_request:",
    MERGE_GROUP_TRIGGER,
    CHECKS_REQUESTED_TRIGGER,
    "  push:",
    RELEASE_BRANCH_TRIGGER,
  ]) {
    requireFragment(source, fragment, label);
  }
  for (const fragment of [
    "pull_request_target",
    "continue-on-error: true",
    "    paths:",
    "    paths-ignore:",
  ]) {
    forbidFragment(source, fragment, label);
  }
  if (/release\/0\.1\.0-r\d/u.test(source)) {
    throw new Error(`${label} hard-codes a concrete release branch`);
  }
}

function verifyDeferredRequiredGate(gate) {
  const source = readFileSync(gate.path, "utf8");
  const label = gate.context;

  verifyCommonTriggers(source, label);
  requireFragment(source, `    name: ${gate.context}`, label);

  const deferredStep = stepSection(source, "Report PR gate deferred to merge queue");
  requireFragment(deferredStep, PR_ONLY, `${label} PR deferral`);
  requireFragment(deferredStep, "deferred until the approved PR enters the merge queue.", `${label} PR deferral`);

  const nixStep = stepSection(source, "Install Nix");
  requireFragment(nixStep, NOT_PR, `${label} Nix setup`);
  requireFragment(nixStep, "uses: cachix/install-nix-action@v31", `${label} Nix setup`);

  const expensiveStep = stepSection(source, gate.expensiveStep);
  requireFragment(expensiveStep, NOT_PR, `${label} slow gate`);
  for (const command of gate.requiredCommands) {
    requireFragment(expensiveStep, command, `${label} slow gate`);
  }

  const verifierStep = stepSection(source, "Verify required-gate workflow contract");
  requireFragment(
    verifierStep,
    `node test/ci/verify-required-browser-gates.mjs ${gate.id}`,
    `${label} self-verifier`,
  );
  forbidFragment(verifierStep, "if:", `${label} self-verifier`);
}

const requestedGateIds = process.argv.slice(2);
const selectedGates = requestedGateIds.length === 0
  ? gates
  : gates.filter((gate) => requestedGateIds.includes(gate.id));
if (selectedGates.length !== (requestedGateIds.length || gates.length)) {
  throw new Error("Unknown required browser gate requested");
}

for (const gate of selectedGates) verifyDeferredRequiredGate(gate);

const browserWorkflow = readFileSync(".github/workflows/plasmon-browser-ci.yml", "utf8");
requireFragment(browserWorkflow, "    name: Packaged Playwright demo acceptance", "Demo browser gate");
const demoJob = browserWorkflow.slice(browserWorkflow.indexOf("  packaged-demo:"));
const demoDeferredStep = stepSection(demoJob, "Report PR gate deferred to merge queue");
requireFragment(demoDeferredStep, PR_ONLY, "Demo PR deferral");

const demoSlowStep = stepSection(demoJob, "Package and run Plasmon demo browser acceptance");
requireFragment(demoSlowStep, NOT_PR, "Demo slow gate");
for (const command of [
  "npm run plasmon:demo:prepare",
  "npm run plasmon:demo:status",
  "npm run plasmon:demo:reinstall",
  "npm run test:e2e:plasmon:demo",
]) {
  requireFragment(demoSlowStep, command, "Demo slow gate");
}
if (/test\/e2e\/plasmon-[^\s'"\\]+\.spec\.[cm]?[jt]sx?/u.test(demoSlowStep)) {
  throw new Error("Demo workflow must select its browser lane semantically instead of enumerating spec files");
}

for (const path of [
  ".github/workflows/plasmon-ci.yml",
  ".github/workflows/kernel-ci.yml",
  ".github/workflows/plasmon-browser-smoke-ci.yml",
  ".github/workflows/plasmon-browser-ci.yml",
  ".github/workflows/plasmon-browser-persistence-ci.yml",
]) {
  const source = readFileSync(path, "utf8");
  requireFragment(source, MERGE_GROUP_TRIGGER, `${path} merge-queue support`);
  requireFragment(source, CHECKS_REQUESTED_TRIGGER, `${path} merge-queue support`);
}

console.log(
  `Required browser gates verified: PR contexts defer expensive work, merge-group/release events run real gates, stable status names and ${releaseBranchGlob} release-role coverage are preserved: ${selectedGates.map((gate) => gate.id).join(", ")}`,
);
