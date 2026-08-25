import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  loadDocumentationOwnershipRegistry,
  mapRelativePath,
  registryRelativePath,
  renderRepositoryDocumentationMap,
  validateDocumentationOwnership,
  validateRepositoryDocumentationMap,
} from "../../doc/documentation-ownership.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");

function registry() {
  return loadDocumentationOwnershipRegistry(repoRoot);
}

function minimalRepository() {
  const root = mkdtempSync(join(tmpdir(), "neutron-docs-"));
  for (const directory of ["apps", "apps/alpha"]) mkdirSync(join(root, directory), { recursive: true });
  for (const file of ["README.md", "AGENTS.md", "apps/README.md", "apps/alpha/README.md"]) {
    writeFileSync(join(root, file), `# ${file}\n`);
  }
  return root;
}

function minimalRegistry() {
  return {
    schema: "neutron-repository-documentation-ownership-v1",
    root: ".",
    discoveryRoots: [{ path: "apps", children: "directories", excluded: [] }],
    boundaries: [
      { path: ".", kind: "repository-root", documentation: [{ path: "README.md", mode: "local" }] },
      { path: "apps", kind: "application-root", documentation: [{ path: "apps/README.md", mode: "local" }] },
      { path: "apps/alpha", kind: "first-party-application", documentation: [{ path: "apps/alpha/README.md", mode: "local" }] },
    ],
  };
}

test("the live repository ownership registry is structurally valid", () => {
  assert.deepEqual(validateDocumentationOwnership(registry(), repoRoot), []);
});

test("an unclassified discovery-root child fails closed", () => {
  const root = minimalRepository();
  mkdirSync(join(root, "apps", "orphan"));
  const errors = validateDocumentationOwnership(minimalRegistry(), root);
  assert.ok(errors.some((error) => error.includes("apps/orphan") && error.includes("unclassified")));
});

test("a missing documentation owner is reported with the boundary", () => {
  const value = registry();
  value.boundaries[0].documentation[0].path = "README.missing.md";
  const errors = validateDocumentationOwnership(value, repoRoot);
  assert.ok(errors.some((error) => error.includes("owning documentation README.missing.md is missing")));
});

test("duplicate local ownership is rejected as ambiguous", () => {
  const value = registry();
  value.boundaries[1].documentation = [{ path: "README.md", mode: "local" }];
  const errors = validateDocumentationOwnership(value, repoRoot);
  assert.ok(errors.some((error) => error.includes("README.md") && error.includes("ambiguously owned")));
});

test("an invalid delegated Plasmon contract is rejected", () => {
  const value = registry();
  value.boundaries.find(({ path }) => path === "apps/plasmon").delegatedContract.registry = "apps/plasmon/missing.json";
  const errors = validateDocumentationOwnership(value, repoRoot);
  assert.ok(errors.some((error) => error.includes("apps/plasmon") && error.includes("delegated registry")));
});

test("generated repository-map drift is rejected", () => {
  const value = registry();
  const map = readFileSync(join(repoRoot, mapRelativePath), "utf8");
  const errors = validateRepositoryDocumentationMap(map.replace("<!-- Generated from", "<!-- Drifted\n<!-- Generated from"), value, repoRoot);
  assert.ok(errors.some((error) => error.includes(mapRelativePath) && error.includes("stale")));
});

test("the delegated Plasmon contract and generated map are current", () => {
  const value = registry();
  const map = readFileSync(join(repoRoot, mapRelativePath), "utf8");
  assert.deepEqual(validateDocumentationOwnership(value, repoRoot), []);
  assert.deepEqual(validateRepositoryDocumentationMap(map, value, repoRoot), []);
  assert.equal(renderRepositoryDocumentationMap(value, repoRoot), renderRepositoryDocumentationMap(value, repoRoot));
  assert.ok(registryRelativePath.endsWith("documentation-ownership.json"));
});

test("active tooling cannot reintroduce the retired review mechanism", () => {
  const patterns = [/docs:review/u, /plasmon-docs-review/u, /documentation-review\\.mjs/u, /documentationReview/u];
  const activeFiles = [
    ".github/workflows/kernel-ci.yml",
    "package.json",
    "apps/plasmon/package.json",
    "apps/plasmon/docs/README.md",
    "apps/plasmon/docs/documentation-boundaries.json",
    "doc/documentation-ownership.mjs",
    "doc/repository-map.md",
  ];
  for (const file of activeFiles) {
    const content = readFileSync(join(repoRoot, file), "utf8");
    for (const pattern of patterns) assert.doesNotMatch(content, pattern, `${file} contains retired documentation tooling`);
  }
});
