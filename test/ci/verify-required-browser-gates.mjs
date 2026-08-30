import { readFileSync } from "node:fs";
import { releaseBranchGlob } from "./plasmon-ci-policy.mjs";

const RELEASE_BRANCH_TRIGGER = `      - '${releaseBranchGlob}'`;
const APPROVAL_TRIGGER = "  pull_request_review:";
const APPROVAL_TYPES = "    types: [submitted]";
const MERGE_GROUP_TRIGGER = "  merge_group:";
const CHECKS_REQUESTED_TRIGGER = "    types: [checks_requested]";
const APPROVED_REVIEW = "github.event_name == 'pull_request_review' && github.event.review.state == 'approved'";
const RETAINED_APPROVAL = "github.event_name == 'pull_request' && steps.retained_approval.outputs.approved == 'true'";
const SPECIALIST_PREAPPROVAL = "github.event_name == 'pull_request' || github.event_name == 'pull_request_review'";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    checkpoint: "Report staged smoke checkpoint",
    expensiveStep: "Package and run Plasmon refactor smoke",
    requiredCommands: ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:smoke"],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    checkpoint: "Report staged specialist checkpoint",
    expensiveStep: "Package and run Plasmon specialist browser acceptance",
    requiredCommands: ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:specialist"],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    checkpoint: "Report staged persistence checkpoint",
    expensiveStep: "Package and run browser persistence gate",
    requiredCommands: ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:persistence"],
  },
];

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}
function stepSection(source, stepName) {
  const marker = `      - name: ${stepName}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing workflow step ${stepName}`);
  const next = source.indexOf("\n      - name:", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function verifyCommonTriggers(source, label) {
  for (const fragment of ["  pull_request:", APPROVAL_TRIGGER, APPROVAL_TYPES, MERGE_GROUP_TRIGGER, CHECKS_REQUESTED_TRIGGER, "  push:", RELEASE_BRANCH_TRIGGER]) {
    requireFragment(source, fragment, label);
  }
  for (const fragment of ["pull_request_target", "continue-on-error: true", "    paths:", "    paths-ignore:"]) forbidFragment(source, fragment, label);
  if (/release\/0\.1\.0-r\d/u.test(source)) throw new Error(`${label} hard-codes a concrete release branch`);
}

function verifyRetainedApproval(source, label) {
  const retained = stepSection(source, "Detect retained approval");
  requireFragment(retained, "reviewDecision", `${label} retained approval`);
  requireFragment(retained, 'decision" = "APPROVED"', `${label} retained approval`);
  requireFragment(retained, "/pulls/$PR_NUMBER/reviews?per_page=100", `${label} approval history`);
  requireFragment(retained, '.state == "APPROVED"', `${label} approval history`);
  requireFragment(retained, "/issues/$PR_NUMBER/timeline?per_page=100", `${label} dismissed approval history`);
  requireFragment(retained, 'review_dismissed', `${label} dismissed approval history`);
  requireFragment(retained, '.dismissed_review.state == "approved"', `${label} dismissed approval history`);
  requireFragment(retained, 'echo "approved=true"', `${label} retained approval`);
}

function verifyApprovalGate(gate) {
  const source = readFileSync(gate.path, "utf8");
  const label = gate.context;
  verifyCommonTriggers(source, label);
  requireFragment(source, `    name: ${gate.context}`, label);
  verifyRetainedApproval(source, label);

  const checkpoint = stepSection(source, gate.checkpoint);
  requireFragment(checkpoint, "merge queue is fast-only", `${label} queue checkpoint`);
  requireFragment(checkpoint, RETAINED_APPROVAL, `${label} retained-approval checkpoint`);
  if (gate.id === "browser") {
    requireFragment(checkpoint, "Specialist acceptance runs on every PR head before and after approval", `${label} pre-approval checkpoint`);
  } else {
    requireFragment(checkpoint, "waits for the PR's first GitHub review approval", `${label} approval checkpoint`);
  }

  const nixStep = stepSection(source, "Install Nix");
  requireFragment(nixStep, APPROVED_REVIEW, `${label} Nix setup`);
  requireFragment(nixStep, RETAINED_APPROVAL, `${label} retained-approval Nix setup`);
  if (gate.id === "browser") requireFragment(nixStep, SPECIALIST_PREAPPROVAL, `${label} pre-approval Nix setup`);
  requireFragment(nixStep, "uses: cachix/install-nix-action@v31", `${label} Nix setup`);

  const expensiveStep = stepSection(source, gate.expensiveStep);
  requireFragment(expensiveStep, APPROVED_REVIEW, `${label} confidence gate`);
  requireFragment(expensiveStep, RETAINED_APPROVAL, `${label} retained-approval confidence gate`);
  if (gate.id === "browser") requireFragment(expensiveStep, SPECIALIST_PREAPPROVAL, `${label} pre-approval confidence gate`);
  for (const command of gate.requiredCommands) requireFragment(expensiveStep, command, `${label} confidence gate`);

  const verifierStep = stepSection(source, "Verify required-gate workflow contract");
  requireFragment(verifierStep, `node test/ci/verify-required-browser-gates.mjs ${gate.id}`, `${label} self-verifier`);
  forbidFragment(verifierStep, "if:", `${label} self-verifier`);
}

const requestedGateIds = process.argv.slice(2);
const selectedGates = requestedGateIds.length === 0 ? gates : gates.filter((gate) => requestedGateIds.includes(gate.id));
if (selectedGates.length !== (requestedGateIds.length || gates.length)) throw new Error("Unknown required browser gate requested");
for (const gate of selectedGates) verifyApprovalGate(gate);

const browserWorkflow = readFileSync(".github/workflows/plasmon-browser-ci.yml", "utf8");
requireFragment(browserWorkflow, "    name: Packaged Playwright demo acceptance", "Demo browser gate");
const demoJob = browserWorkflow.slice(browserWorkflow.indexOf("  packaged-demo:"));
verifyRetainedApproval(demoJob, "Demo browser gate");
const demoCheckpoint = stepSection(demoJob, "Report staged demo checkpoint");
requireFragment(demoCheckpoint, "merge queue is fast-only", "Demo queue checkpoint");
requireFragment(demoCheckpoint, RETAINED_APPROVAL, "Demo retained-approval checkpoint");
const demoSlowStep = stepSection(demoJob, "Package and run Plasmon demo browser acceptance");
requireFragment(demoSlowStep, APPROVED_REVIEW, "Demo confidence gate");
requireFragment(demoSlowStep, RETAINED_APPROVAL, "Demo retained-approval confidence gate");
for (const command of ["npm run plasmon:demo:prepare", "npm run plasmon:demo:status", "npm run plasmon:demo:reinstall", "npm run test:e2e:plasmon:demo"]) requireFragment(demoSlowStep, command, "Demo confidence gate");

for (const path of [".github/workflows/plasmon-ci.yml", ".github/workflows/kernel-ci.yml", ".github/workflows/plasmon-browser-smoke-ci.yml", ".github/workflows/plasmon-browser-ci.yml", ".github/workflows/plasmon-browser-persistence-ci.yml"]) {
  const source = readFileSync(path, "utf8");
  requireFragment(source, MERGE_GROUP_TRIGGER, `${path} merge-queue support`);
  requireFragment(source, CHECKS_REQUESTED_TRIGGER, `${path} merge-queue support`);
}

console.log(`Required browser gates verified: Specialist package/Playwright runs on every PR head before approval and on submitted review events, the remaining expensive package/Playwright work starts at first normal approval and remains enabled for every later PR head even if that approval is dismissed, merge_group keeps stable contexts cheap, and ${releaseBranchGlob} role coverage is preserved: ${selectedGates.map((gate) => gate.id).join(", ")}`);
