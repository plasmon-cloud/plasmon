import { readFileSync } from "node:fs";

const gates = [
  {
    path: ".github/workflows/plasmon-browser-smoke-ci.yml",
    context: "Packaged refactor smoke",
    scopeId: "packaged_smoke_scope",
    output: "run_packaged_smoke",
  },
  {
    path: ".github/workflows/plasmon-browser-ci.yml",
    context: "Packaged Playwright specialist acceptance",
    scopeId: "packaged_browser_scope",
    output: "run_packaged_browser",
  },
  {
    path: ".github/workflows/plasmon-browser-persistence-ci.yml",
    context: "Packaged browser persistence",
    scopeId: "persistence_scope",
    output: "run_persistence",
  },
];

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

for (const gate of gates) {
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

  if (!source.includes(`id: ${gate.scopeId}`)) {
    throw new Error(`${gate.context} is missing its cheap-skip scope detector`);
  }

  const guard = `if: steps.${gate.scopeId}.outputs.${gate.output} == 'true'`;
  const guardCount = source.split(guard).length - 1;
  if (guardCount < 2) {
    throw new Error(`${gate.context} must guard both Nix setup and the expensive browser step`);
  }
}

console.log("Required r2 browser gate workflow contract verified");
