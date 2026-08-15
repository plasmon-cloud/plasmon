import { readFileSync } from "node:fs";

const releaseBranch = "release/0.1.0-r2";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    expensiveStepName: "Package and run Plasmon refactor smoke",
    expensiveFragments: [
      "npm ci",
      "node test/ci/verify-playwright-gate.mjs",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "npm run test:e2e:plasmon:smoke",
    ],
    forbiddenPrSelectionFragments: [
      "packaged_smoke_scope",
      "run_packaged_smoke",
      "Detect packaged-smoke-relevant changes",
    ],
    pushBranches: [releaseBranch],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    expensiveStepName: "Package and run Plasmon specialist browser acceptance",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "npm run test:e2e:plasmon:specialist",
    ],
    forbiddenPrSelectionFragments: [
      "packaged_browser_scope",
      "run_packaged_browser",
      "Detect specialist-browser-relevant changes",
    ],
    pushBranches: [
      "version-0.1.0-os",
      releaseBranch,
    ],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    expensiveStepName: "Package and run browser persistence gate",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "NEUTRON_NDEPLOY_CONFIG=plasmon-local.ndeploy.json npx --no-install playwright test test/e2e/plasmon-persistence.spec.ts",
    ],
    forbiddenPrSelectionFragments: [
      "persistence_scope",
      "run_persistence",
      "Detect persistence-relevant changes",
    ],
    pushBranches: [releaseBranch],
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
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function stepSectionFromIndex(lines, start) {
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^      - name: /.test(lines[index])) {
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
  if (/^        if:/m.test(step)) {
    throw new Error(`${label} must run unconditionally on every PR`);
  }
}

function assertPushBranch(path, branch) {
  const source = readFileSync(path, "utf8");
  const push = eventSection(source.split(/\r?\n/), "push");
  if (!push.includes(`      - ${branch}`)) {
    throw new Error(`${path} direct-push coverage lost required branch ${branch}`);
  }
  return push;
}

function assertUnfilteredReleasePush(path) {
  const push = assertPushBranch(path, releaseBranch);
  if (push.some((line) => /^    paths(?:-ignore)?:/.test(line))) {
    throw new Error(`${path} cannot path-filter ${releaseBranch} pushes; every release push must schedule this required gate`);
  }
  return push;
}

for (const gate of selectedGates) {
  const source = readFileSync(gate.path, "utf8");
  const lines = source.split(/\r?\n/);
  const pullRequest = eventSection(lines, "pull_request");

  if (pullRequest.some((line) => /^    paths(?:-ignore)?:/.test(line))) {
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
    '${{ github.event.pull_request.base.sha }}',
    '${{ github.event.pull_request.head.sha }}',
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

  if (gate.pushBranches) {
    const push = eventSection(lines, "push");
    for (const branch of gate.pushBranches) {
      if (!push.includes(`      - ${branch}`)) {
        throw new Error(`${gate.context} direct-push coverage lost required branch ${branch}`);
      }
    }
  }
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

console.log(`Required r2 browser gate PR-always-run and unfiltered five-gate release-push contracts verified: ${selectedGates.map((gate) => gate.id).join(", ")}`);
