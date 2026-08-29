import { readFileSync } from "node:fs";
import {
  plasmonBranchRole,
  releaseBranchGlob,
} from "./plasmon-ci-policy.mjs";

const releaseBranchLine = `      - '${releaseBranchGlob}'`;

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    expensiveStepName: "Package and run Plasmon refactor smoke",
    expensiveFragments: [
      "npm ci",
      "node test/ci/verify-playwright-gate.mjs",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:smoke",
    ],
    forbiddenPrSelectionFragments: [
      "packaged_smoke_scope",
      "run_packaged_smoke",
      "Detect packaged-smoke-relevant changes",
    ],
    pushBranches: [releaseBranchLine],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    expensiveStepName: "Package and run Plasmon specialist browser acceptance",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:specialist",
    ],
    forbiddenPrSelectionFragments: [
      "packaged_browser_scope",
      "run_packaged_browser",
      "Detect specialist-browser-relevant changes",
    ],
    pushBranches: [
      "      - version-0.1.0-os",
      releaseBranchLine,
    ],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    expensiveStepName: "Package and run browser persistence gate",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:local:prepare",
      "npm run plasmon:local:status",
      "npm run plasmon:local:reinstall",
      "npm run test:e2e:plasmon:persistence",
    ],
    forbiddenPrSelectionFragments: [
      "persistence_scope",
      "run_persistence",
      "Detect persistence-relevant changes",
    ],
    pushBranches: [releaseBranchLine],
  },
];

const requestedGateIds = process.argv.slice(2);
const knownGateIds = new Set(gates.map((gate) => gate.id));
for (const gateId of requestedGateIds) {
  if (!knownGateIds.has(gateId)) {
    throw new Error(`Unknown required browser gate ${gateId}`);
  }
}
const selectedGates = requestedGateIds.length > 0
  ? gates.filter((gate) => requestedGateIds.includes(gate.id))
  : gates;

function eventSection(lines, eventName) {
  const marker = `  ${eventName}:`;
  const start = lines.findIndex((line) => line === marker);
  if (start < 0) throw new Error(`Missing ${eventName} event`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function stepSectionFromIndex(lines, start) {
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^      - name: /u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function stepSectionByName(lines, stepName) {
  const marker = `      - name: ${stepName}`;
  const start = lines.findIndex((line) => line === marker);
  if (start < 0) throw new Error(`Missing workflow step ${stepName}`);
  return stepSectionFromIndex(lines, start);
}

function stepCount(source, stepName) {
  return source.split(`      - name: ${stepName}`).length - 1;
}

function assertUnconditionalStep(step, label) {
  if (/^        if:/mu.test(step)) {
    throw new Error(`${label} must run unconditionally on every PR`);
  }
}

function assertUnfilteredReleasePush(path) {
  const source = readFileSync(path, "utf8");
  const push = eventSection(source.split(/\r?\n/u), "push");
  if (!push.includes(releaseBranchLine)) {
    throw new Error(`${path} direct-push coverage lost release branch role ${releaseBranchGlob}`);
  }
  if (push.some((line) => /^    paths(?:-ignore)?:/u.test(line))) {
    throw new Error(`${path} cannot path-filter release-role pushes; every release push must schedule this required gate`);
  }
  if (/release\/0\.1\.0-r\d/u.test(source)) {
    throw new Error(`${path} hard-codes a concrete release branch instead of the release role`);
  }
  return push;
}

for (const gate of selectedGates) {
  const source = readFileSync(gate.path, "utf8");
  const lines = source.split(/\r?\n/u);
  const pullRequest = eventSection(lines, "pull_request");

  if (pullRequest.some((line) => /^    paths(?:-ignore)?:/u.test(line))) {
    throw new Error(`${gate.context} cannot use a pull_request path filter`);
  }
  if (!source.includes(`    name: ${gate.context}`)) {
    throw new Error(`${gate.path} no longer reports stable context ${gate.context}`);
  }
  if (source.includes("continue-on-error: true")) {
    throw new Error(`${gate.context} must not mask required-gate failures with continue-on-error`);
  }

  const verifierName = "Verify required-gate workflow contract";
  const verifierCommand = `node test/ci/verify-required-browser-gates.mjs ${gate.id}`;
  if (stepCount(source, verifierName) !== 1) {
    throw new Error(`${gate.context} must execute its required-gate verifier exactly once`);
  }
  const verifier = stepSectionByName(lines, verifierName);
  assertUnconditionalStep(verifier, `${gate.context} required-gate verifier`);
  if (!verifier.includes(verifierCommand)) {
    throw new Error(`${gate.context} required-gate verifier must run ${verifierCommand}`);
  }

  const forbiddenGlobalFragments = [
    "${{ github.event.pull_request.base.sha }}",
    "${{ github.event.pull_request.head.sha }}",
    "git diff --name-only",
  ];
  for (const fragment of [...forbiddenGlobalFragments, ...gate.forbiddenPrSelectionFragments]) {
    if (source.includes(fragment)) {
      throw new Error(`${gate.context} must not select PR execution by changed files: ${fragment}`);
    }
  }

  const nixStep = stepSectionByName(lines, "Install Nix");
  assertUnconditionalStep(nixStep, `${gate.context} Nix setup`);
  if (!nixStep.includes("uses: cachix/install-nix-action@v31")) {
    throw new Error(`${gate.context} must preserve Nix setup`);
  }

  const expensiveStep = stepSectionByName(lines, gate.expensiveStepName);
  assertUnconditionalStep(expensiveStep, `${gate.context} real packaged/browser gate`);
  for (const fragment of gate.expensiveFragments) {
    if (!expensiveStep.includes(fragment)) {
      throw new Error(`${gate.context} real gate lost required acceptance fragment: ${fragment}`);
    }
  }
  if (gate.id !== "browser" && expensiveStep.includes("npm run plasmon:demo:")) {
    throw new Error(`${gate.context} must use the bounded plasmon:local:* fixture, not the full demo manifest`);
  }

  const push = eventSection(lines, "push");
  for (const branchLine of gate.pushBranches) {
    if (!push.includes(branchLine)) {
      throw new Error(`${gate.context} direct-push coverage lost required branch role/legacy branch ${branchLine.trim()}`);
    }
  }
}

const browserWorkflow = readFileSync(".github/workflows/plasmon-browser-ci.yml", "utf8");
if (!browserWorkflow.includes("    name: Packaged Playwright demo acceptance")) {
  throw new Error("Packaged browser workflow lost stable Demo acceptance context");
}
const demoLines = browserWorkflow.split(/\r?\n/u);
const demoStep = stepSectionByName(demoLines, "Package and run Plasmon demo browser acceptance");
for (const fragment of [
  "npm run plasmon:demo:prepare",
  "npm run plasmon:demo:status",
  "npm run plasmon:demo:reinstall",
  "npm run test:e2e:plasmon:demo",
]) {
  if (!demoStep.includes(fragment)) throw new Error(`Demo gate lost required capability fragment: ${fragment}`);
}
if (/test\/e2e\/plasmon-[^\s'"\\]+\.spec\.[cm]?[jt]sx?/u.test(demoStep)) {
  throw new Error("Demo workflow must select its browser lane semantically instead of enumerating spec files");
}

const requiredReleasePushWorkflows = [
  ".github/workflows/plasmon-ci.yml",
  ".github/workflows/kernel-ci.yml",
  ".github/workflows/plasmon-browser-smoke-ci.yml",
  ".github/workflows/plasmon-browser-ci.yml",
  ".github/workflows/plasmon-browser-persistence-ci.yml",
];
for (const path of requiredReleasePushWorkflows) {
  assertUnfilteredReleasePush(path);
}

for (const ref of ["release/0.1.0-r2r3", "release/0.1.0-r4", "release/demo"]) {
  if (plasmonBranchRole(ref) !== "release") throw new Error(`Release-role policy rejected ${ref}`);
}
for (const ref of ["main", "feature/example", "", "release/"]) {
  if (plasmonBranchRole(ref) !== "unknown") throw new Error(`Release-role policy must fail closed for ${ref || "(empty)"}`);
}

console.log(`Required browser gate PR-always-run, semantic Demo selection, and unfiltered ${releaseBranchGlob} release-role push contracts verified: ${selectedGates.map((gate) => gate.id).join(", ")}`);
