import { readFileSync } from "node:fs";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    scopeId: "packaged_smoke_scope",
    output: "run_packaged_smoke",
    scopePatterns: [
      "apps/plasmon/*",
      "apps/review/*",
      "apps/kernel/*",
      "packages/neutron-provision/*",
      "packages/neutron-tools/*",
      "test/e2e/plasmon-demo-environment.ts",
      "test/e2e/plasmon-browser-health.ts",
      "test/e2e/plasmon-refactor-smoke.spec.ts",
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

function stepSection(lines, stepId) {
  const idMarker = `        id: ${stepId}`;
  const idIndex = lines.findIndex((line) => line === idMarker);
  if (idIndex < 0) throw new Error(`Missing workflow step id ${stepId}`);

  let start = idIndex;
  while (start > 0 && !/^      - name: /.test(lines[start])) start -= 1;
  if (!/^      - name: /.test(lines[start])) {
    throw new Error(`Cannot locate workflow step start for ${stepId}`);
  }

  let end = lines.length;
  for (let index = idIndex + 1; index < lines.length; index += 1) {
    if (/^      - name: /.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
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

  const detector = stepSection(lines, gate.scopeId);
  for (const pattern of gate.scopePatterns) {
    if (!detector.includes(pattern)) {
      throw new Error(`${gate.context} cheap-skip scope lost required path pattern ${pattern}`);
    }
  }

  if (!detector.includes(`echo "${gate.output}=true" >> "$GITHUB_OUTPUT"`)) {
    throw new Error(`${gate.context} must run its expensive path outside pull_request events`);
  }

  const guard = `if: steps.${gate.scopeId}.outputs.${gate.output} == 'true'`;
  const guardCount = source.split(guard).length - 1;
  if (guardCount < 2) {
    throw new Error(`${gate.context} must guard both Nix setup and the expensive browser step`);
  }
}

console.log(`Required r2 browser gate workflow contract verified: ${selectedGates.map((gate) => gate.id).join(", ")}`);
