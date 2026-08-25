import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generatedBoundaryBlock } from "../../apps/plasmon/docs/documentation-boundaries.mjs";
import {
  findRetiredDocumentationMechanismReferences,
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

function delegatedFixture() {
  const root = mkdtempSync(join(tmpdir(), "neutron-delegated-docs-"));
  for (const directory of ["apps", "apps/alpha", "apps/plasmon", "apps/plasmon/docs"]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const file of [
    "README.md",
    "apps/README.md",
    "apps/alpha/README.md",
    "apps/plasmon/README.md",
    "apps/plasmon/AGENTS.md",
    "apps/plasmon/docs/README.md",
  ]) writeFileSync(join(root, file), `# ${file}\n`);

  const nested = {
    schema: "plasmon-documentation-boundaries-v1",
    root: "apps/plasmon",
    discoveryRoots: [],
    boundaries: [{
      path: "apps/plasmon",
      kind: "application-root",
      readme: "local",
      agents: { mode: "local" },
    }],
  };
  const outer = {
    schema: "neutron-repository-documentation-ownership-v1",
    root: ".",
    discoveryRoots: [{ path: "apps", children: "directories", excluded: [] }],
    boundaries: [
      { path: ".", kind: "repository-root", documentation: [{ path: "README.md", mode: "local" }] },
      { path: "apps", kind: "application-root", documentation: [{ path: "apps/README.md", mode: "local" }] },
      { path: "apps/alpha", kind: "first-party-application", documentation: [{ path: "apps/alpha/README.md", mode: "local" }] },
      {
        path: "apps/plasmon",
        kind: "delegated-application",
        documentation: [{ path: "apps/plasmon/docs/README.md", mode: "delegated" }],
        delegatedContract: {
          registry: "apps/plasmon/docs/documentation-boundaries.json",
          map: "apps/plasmon/docs/README.md",
          root: "apps/plasmon",
        },
      },
    ],
  };
  const registryPath = join(root, "doc/documentation-ownership.json");
  const nestedRegistryPath = join(root, "apps/plasmon/docs/documentation-boundaries.json");
  const mapPath = join(root, "apps/plasmon/docs/README.md");
  mkdirSync(join(root, "doc"), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(outer, null, 2)}\n`);
  writeFileSync(nestedRegistryPath, `${JSON.stringify(nested, null, 2)}\n`);
  writeFileSync(mapPath, `# Fixture map\n\n${generatedBoundaryBlock(nested)}\n`);
  return { root, nested, nestedRegistryPath, mapPath };
}

test("a broken delegated Plasmon contract is rejected by the repository validator", () => {
  const fixture = delegatedFixture();
  try {
    rmSync(join(fixture.root, "apps/plasmon/AGENTS.md"));
    const ownershipErrors = validateDocumentationOwnership(
      JSON.parse(readFileSync(join(fixture.root, "doc/documentation-ownership.json"), "utf8")),
      fixture.root,
    );
    assert.ok(ownershipErrors.some((error) => error.includes("delegated structural contract") && error.includes("AGENTS.md")));

    writeFileSync(join(fixture.root, "apps/plasmon/AGENTS.md"), "# Fixture rules\n");
    fixture.nested.discoveryRoots = [{ path: "apps/plasmon/src", nonBoundaryChildren: [] }];
    mkdirSync(join(fixture.root, "apps/plasmon/src/orphan"), { recursive: true });
    writeFileSync(fixture.nestedRegistryPath, `${JSON.stringify(fixture.nested, null, 2)}\n`);
    const discoveryErrors = validateDocumentationOwnership(
      JSON.parse(readFileSync(join(fixture.root, "doc/documentation-ownership.json"), "utf8")),
      fixture.root,
    );
    assert.ok(discoveryErrors.some((error) => error.includes("delegated structural contract") && error.includes("unclassified direct child")));

    fixture.nested.discoveryRoots = [];
    writeFileSync(fixture.nestedRegistryPath, `${JSON.stringify(fixture.nested, null, 2)}\n`);
    writeFileSync(
      fixture.mapPath,
      readFileSync(fixture.mapPath, "utf8").replace("| Boundary | Kind | README | AGENTS |", "| Drift | Kind | README | AGENTS |"),
    );
    const mapErrors = validateDocumentationOwnership(
      JSON.parse(readFileSync(join(fixture.root, "doc/documentation-ownership.json"), "utf8")),
      fixture.root,
    );
    assert.ok(mapErrors.some((error) => error.includes("delegated map contract") && error.includes("generated boundary table is stale")));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
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
  const excluded = [
    "test/ci/documentation-ownership.test.mjs",
    "apps/plasmon/test/documentationContract.test.ts",
    "doc/documentation-ownership.mjs",
  ];
  assert.deepEqual(findRetiredDocumentationMechanismReferences(repoRoot, excluded), []);

  const fixture = mkdtempSync(join(tmpdir(), "neutron-retired-docs-"));
  try {
    mkdirSync(join(fixture, "apps/plasmon/docs"), { recursive: true });
    writeFileSync(join(fixture, "apps/plasmon/docs/documentation-review.mjs"), "// retired file\n");
    writeFileSync(join(fixture, "apps/plasmon/docs/legacy.md"), "The old docs:review command must stay absent.\n");
    const references = findRetiredDocumentationMechanismReferences(fixture);
    assert.ok(references.some((reference) => reference.includes("documentation-review.mjs")));
    assert.ok(references.some((reference) => reference.includes("docs:review")));

    writeFileSync(join(fixture, "apps/plasmon/docs/negative.test.ts"), "documentation-review.mjs docs:review\n");
    assert.deepEqual(
      findRetiredDocumentationMechanismReferences(fixture, ["apps/plasmon/docs/negative.test.ts"]),
      references,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
