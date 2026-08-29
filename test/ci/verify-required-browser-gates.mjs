import { readFileSync } from "node:fs";
import { releaseBranchGlob } from "./plasmon-ci-policy.mjs";

const releaseBranchLine = `      - '${releaseBranchGlob}'`;
const mergeGroupLine = "  merge_group:";
const checksRequestedLine = "    types: [checks_requested]";
const prDeferredIf = "if: ${{ github.event_name == 'pull_request' }}";
const slowIf = "if: ${{ github.event_name != 'pull_request' }}";

const gates = [
  {
    id: "smoke",
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    expensiveStepName: "Package and run Plasmon refactor smoke",
    expensiveFragments: ["npm ci", "node test/ci/verify-playwright-gate.mjs", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:smoke"],
  },
  {
    id: "browser",
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    expensiveStepName: "Package and run Plasmon specialist browser acceptance",
    expensiveFragments: ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:specialist"],
  },
  {
    id: "persistence",
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    expensiveStepName: "Package and run browser persistence gate",
    expensiveFragments: ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:status", "npm run plasmon:local:reinstall", "npm run test:e2e:plasmon:persistence"],
  },
];

const requested = process.argv.slice(2);
const selected = requested.length ? gates.filter((gate) => requested.includes(gate.id)) : gates;
if (selected.length !== (requested.length || gates.length)) throw new Error("Unknown required browser gate requested");

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

for (const gate of selected) {
  const source = readFileSync(gate.path, "utf8");
  const label = gate.context;
  for (const fragment of [
    "  pull_request:", mergeGroupLine, checksRequestedLine, "  push:", releaseBranchLine,
    `    name: ${gate.context}`,
    "- name: Report PR gate deferred to merge queue",
    "deferred until the approved PR enters the merge queue.",
  ]) requireFragment(source, fragment, label);

  for (const fragment of ["pull_request_target", "continue-on-error: true", "    paths:", "    paths-ignore:"]) forbidFragment(source, fragment, label);
  if (/release\/0\.1\.0-r\d/u.test(source)) throw new Error(`${label} hard-codes a concrete release branch`);

  const deferred = stepSection(source, "Report PR gate deferred to merge queue");
  requireFragment(deferred, prDeferredIf, `${label} deferred PR step`);
  const nix = stepSection(source, "Install Nix");
  requireFragment(nix, slowIf, `${label} Nix setup`);
  requireFragment(nix, "uses: cachix/install-nix-action@v31", `${label} Nix setup`);
  const expensive = stepSection(source, gate.expensiveStepName);
  requireFragment(expensive, slowIf, `${label} real slow gate`);
  for (const fragment of gate.expensiveFragments) requireFragment(expensive, fragment, `${label} real slow gate`);
  const verifier = stepSection(source, "Verify required-gate workflow contract");
  requireFragment(verifier, `node test/ci/verify-required-browser-gates.mjs ${gate.id}`, `${label} verifier`);
  forbidFragment(verifier, "if:", `${label} verifier`);
}

const browser = readFileSync(".github/workflows/plasmon-browser-ci.yml", "utf8");
requireFragment(browser, "    name: Packaged Playwright demo acceptance", "Demo browser gate");
const demoSource = browser.slice(browser.indexOf("  packaged-demo:"));
requireFragment(demoSource, "- name: Report PR gate deferred to merge queue", "Demo deferred PR step");
requireFragment(stepSection(demoSource, "Report PR gate deferred to merge queue"), prDeferredIf, "Demo deferred PR step");
const demo = stepSection(demoSource, "Package and run Plasmon demo browser acceptance");
requireFragment(demo, slowIf, "Demo real slow gate");
for (const fragment of ["npm run plasmon:demo:prepare", "npm run plasmon:demo:status", "npm run plasmon:demo:reinstall", "npm run test:e2e:plasmon:demo"]) requireFragment(demo, fragment, "Demo real slow gate");
if (/test\/e2e\/plasmon-[^\s'"\\]+\.spec\.[cm]?[jt]sx?/u.test(demo)) throw new Error("Demo workflow must select its browser lane semantically instead of enumerating spec files");

for (const path of [
  ".github/workflows/plasmon-ci.yml", ".github/workflows/kernel-ci.yml", ".github/workflows/plasmon-browser-smoke-ci.yml", ".github/workflows/plasmon-browser-ci.yml", ".github/workflows/plasmon-browser-persistence-ci.yml",
]) {
  const source = readFileSync(path, "utf8");
  requireFragment(source, mergeGroupLine, `${path} merge-queue support`);
  requireFragment(source, checksRequestedLine, `${path} merge-queue support`);
}

console.log(`Required browser gates verified for staged CI: PR contexts report deferred success, merge_group/release pushes run real slow workloads, stable required names and ${releaseBranchGlob} role are preserved: ${selected.map((gate) => gate.id).join(", ")}`);
