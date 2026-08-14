import { readFileSync } from "node:fs";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    scopeId: "packaged_smoke_scope",
    output: "run_packaged_smoke",
    expensiveStepName: "Package and run Plasmon refactor smoke",
    expensiveFragments: [
      "npm ci",
      "node test/ci/verify-playwright-gate.mjs",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "npm run test:e2e:plasmon:smoke",
    ],
    scopePatterns: [
      "apps/plasmon/*",
      "apps/review/*",
      "apps/kernel/*",
      "packages/neutron-provision/*",
      "packages/neutron-tools/*",
      "test/e2e/plasmon-demo-environment.ts",
      "test/e2e/plasmon-browser-health.ts",
      "test/e2e/plasmon-refactor-smoke.spec.ts",
      "test/ci/*playwright-gate*",
      "playwright.config.ts",
      "plasmon-local.ndeploy.json",
      "package.json",
      "package-lock.json",
      ".github/workflows/plasmon-browser-smoke-ci.yml",
    ],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    scopeId: "packaged_browser_scope",
    output: "run_packaged_browser",
    expensiveStepName: "Package and run Plasmon specialist browser acceptance",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "npm run test:e2e:plasmon:specialist",
    ],
    pushBranches: [
      "version-0.1.0-os",
      "release/0.1.0-r2",
    ],
    scopePatterns: [
      "apps/plasmon/*",
      "apps/review/*",
      "apps/kernel/*",
      "packages/neutron-provision/*",
      "packages/neutron-tools/*",
      "test/e2e/plasmon-demo-environment.ts",
      "test/e2e/plasmon-browser-health.ts",
      "test/e2e/plasmon-refactor-smoke.spec.ts",
      "test/e2e/plasmon-golden-path.spec.ts",
      "test/e2e/plasmon-monaco-packaged.spec.ts",
      "test/e2e/plasmon-review-demo.spec.ts",
      "test/e2e/plasmon-emulatorjs-proof.spec.ts",
      "test/e2e/plasmon-demo-game.spec.ts",
      "playwright.config.ts",
      "plasmon-local.ndeploy.json",
      "package.json",
      "package-lock.json",
      ".github/workflows/plasmon-browser-ci.yml",
    ],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    scopeId: "persistence_scope",
    output: "run_persistence",
    expensiveStepName: "Package and run browser persistence gate",
    expensiveFragments: [
      "npm ci",
      "npm run plasmon:demo:prepare",
      "npm run plasmon:demo:status",
      "npm run plasmon:demo:reinstall",
      "NEUTRON_NDEPLOY_CONFIG=plasmon-local.ndeploy.json npx --no-install playwright test test/e2e/plasmon-persistence.spec.ts",
    ],
    scopePatterns: [
      "apps/plasmon/*",
      "apps/kernel/src/workspace/AppBackgroundFrames.tsx",
      "apps/kernel/src/capabilities/*",
      "apps/kernel/src/runtime_deployment.ts",
      "packages/neutron-compiler/*",
      "packages/neutron-provision/*",
      "packages/neutron-tools/*",
      "test/e2e/local-playwright-identity.ts",
      "test/e2e/plasmon-demo-environment.ts",
      "test/e2e/plasmon-persistence.spec.ts",
      "playwright.config.ts",
      "plasmon-local.ndeploy.json",
      "package-lock.json",
      ".github/workflows/plasmon-browser-persistence-ci.yml",
    ],
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

function stepSectionById(lines, stepId) {
  const idMarker = `        id: ${stepId}`;
  const idIndex = lines.findIndex((line) => line === idMarker);
  if (idIndex < 0) throw new Error(`Missing workflow step id ${stepId}`);

  let start = idIndex;
  while (start > 0 && !/^      - name: /.test(lines[start])) start -= 1;
  if (!/^      - name: /.test(lines[start])) {
    throw new Error(`Cannot locate workflow step start for ${stepId}`);
  }
  return stepSectionFromIndex(lines, start);
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
    throw new Error(`${label} must run unconditionally`);
  }
}

function assertGuardedStep(lines, stepName, guard, context) {
  const step = stepSectionByName(lines, stepName);
  if (!step.includes(`        ${guard}`)) {
    throw new Error(`${context} must guard ${stepName} with ${guard}`);
  }
  return step;
}

for (const gate of selectedGates) {
  const source = readFileSync(gate.path, "utf8");
  const lines = source.split(/\r?\n/);
  const pullRequest = eventSection(lines, "pull_request");

  if (pullRequest.some((line) => /^    paths(?:-ignore)?:/.test(line))) {
    throw new Error(`${gate.context} can disappear behind a pull_request path filter`);
  }

  if (!source.includes(`    name: ${gate.context}`)) {
    throw new Error(`${gate.path} no longer reports stable context ${gate.context}`);
  }

  if (!source.includes("fetch-depth: 0")) {
    throw new Error(`${gate.context} cannot reliably diff the PR base/head for cheap-skip scope`);
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

  const detector = stepSectionById(lines, gate.scopeId);
  assertUnconditionalStep(detector, `${gate.context} scope detector`);

  if (source.indexOf(`      - name: ${verifierName}`) > source.indexOf(`        id: ${gate.scopeId}`)) {
    throw new Error(`${gate.context} required-gate verifier must run before its scope detector`);
  }

  for (const pattern of gate.scopePatterns) {
    if (!detector.includes(pattern)) {
      throw new Error(`${gate.context} cheap-skip scope lost required path pattern ${pattern}`);
    }
  }

  const requiredDetectorFragments = [
    "set -euo pipefail",
    'if [ "${{ github.event_name }}" != "pull_request" ]; then',
    `echo "${gate.output}=true" >> "$GITHUB_OUTPUT"`,
    'base_sha="${{ github.event.pull_request.base.sha }}"',
    'head_sha="${{ github.event.pull_request.head.sha }}"',
    'git diff --name-only "$base_sha" "$head_sha"',
    `${gate.output}=false`,
    'while IFS= read -r path; do',
    'case "$path" in',
    `echo "${gate.output}=$${gate.output}" >> "$GITHUB_OUTPUT"`,
  ];
  for (const fragment of requiredDetectorFragments) {
    if (!detector.includes(fragment)) {
      throw new Error(`${gate.context} cheap-skip detector lost required fragment: ${fragment}`);
    }
  }

  const nonPrIndex = detector.indexOf('if [ "${{ github.event_name }}" != "pull_request" ]; then');
  const baseIndex = detector.indexOf('base_sha="${{ github.event.pull_request.base.sha }}"');
  const falseIndex = detector.indexOf(`${gate.output}=false`);
  const loopIndex = detector.indexOf('while IFS= read -r path; do');
  if (nonPrIndex < 0 || nonPrIndex > baseIndex) {
    throw new Error(`${gate.context} must force non-PR executions onto the expensive path before PR-only diff logic`);
  }
  if (falseIndex < 0 || falseIndex > loopIndex) {
    throw new Error(`${gate.context} must default PR relevance to false before scanning changed paths`);
  }

  const guard = `if: steps.${gate.scopeId}.outputs.${gate.output} == 'true'`;
  const nixStep = assertGuardedStep(lines, "Install Nix", guard, gate.context);
  if (!nixStep.includes("uses: cachix/install-nix-action@v31")) {
    throw new Error(`${gate.context} must preserve guarded Nix setup`);
  }

  const expensiveStep = assertGuardedStep(lines, gate.expensiveStepName, guard, gate.context);
  for (const fragment of gate.expensiveFragments) {
    if (!expensiveStep.includes(fragment)) {
      throw new Error(`${gate.context} expensive path lost required acceptance fragment: ${fragment}`);
    }
  }

  if (gate.pushBranches) {
    const push = eventSection(lines, "push");
    if (!push.includes("    paths:")) {
      throw new Error(`${gate.context} must preserve the specialist direct-push path filter`);
    }
    for (const branch of gate.pushBranches) {
      if (!push.includes(`      - ${branch}`)) {
        throw new Error(`${gate.context} direct-push coverage lost required branch ${branch}`);
      }
    }
    for (const pattern of gate.scopePatterns) {
      if (!push.some((line) => line.includes(pattern))) {
        throw new Error(`${gate.context} direct-push path filter lost required specialist path ${pattern}`);
      }
    }
  }
}

console.log(`Required r2 browser gate workflow contract verified: ${selectedGates.map((gate) => gate.id).join(", ")}`);
