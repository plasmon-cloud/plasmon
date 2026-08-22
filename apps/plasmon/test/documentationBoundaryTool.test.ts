import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  BOUNDARY_TABLE_END,
  BOUNDARY_TABLE_START,
  docsMapRelativePath,
  loadDocumentationBoundaryRegistry,
  replaceGeneratedBoundaryBlock,
  validateDocumentationBoundaries,
  validateDocumentationMap,
} from "../docs/documentation-boundaries.mjs";

const appRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = resolve(appRoot, "../..");

function fixtureRegistry() {
  return {
    schema: "plasmon-documentation-boundaries-v1",
    root: "apps/plasmon",
    discoveryRoots: [
      {
        path: "apps/plasmon/src/os",
        children: "directories",
        nonBoundaryChildren: [],
      },
    ],
    boundaries: [
      {
        path: "apps/plasmon/src/os",
        kind: "os-root",
        readme: "local",
        agents: { mode: "local" },
      },
      {
        path: "apps/plasmon/src/os/sharing",
        kind: "os-subsystem",
        readme: "local",
        agents: { mode: "inherited", from: "apps/plasmon/src/os/AGENTS.md" },
      },
    ],
  };
}

function createFixture() {
  const root = mkdtempSync(resolve(tmpdir(), "plasmon-doc-boundaries-"));
  for (const path of ["apps/plasmon/src/os", "apps/plasmon/src/os/sharing"]) {
    mkdirSync(resolve(root, path), { recursive: true });
    writeFileSync(resolve(root, path, "README.md"), `# ${path}\n`);
  }
  writeFileSync(resolve(root, "apps/plasmon/src/os/AGENTS.md"), "# OS rules\n");
  return root;
}

test("current repository boundary registry and generated map validate", () => {
  const registry = loadDocumentationBoundaryRegistry(repoRoot);
  expect(validateDocumentationBoundaries(registry, repoRoot)).toEqual([]);
  const docsMap = readFileSync(resolve(repoRoot, docsMapRelativePath), "utf8");
  expect(validateDocumentationMap(docsMap, registry)).toEqual([]);
});

test("validator reports missing boundaries and required local documentation", () => {
  const root = createFixture();
  try {
    const registry = fixtureRegistry();
    expect(validateDocumentationBoundaries(registry, root)).toEqual([]);

    rmSync(resolve(root, "apps/plasmon/src/os/sharing"), { recursive: true, force: true });
    expect(validateDocumentationBoundaries(registry, root).join("\n")).toContain(
      "apps/plasmon/src/os/sharing: declared boundary directory is missing",
    );

    mkdirSync(resolve(root, "apps/plasmon/src/os/sharing"), { recursive: true });
    writeFileSync(resolve(root, "apps/plasmon/src/os/sharing/README.md"), "# Sharing\n");
    rmSync(resolve(root, "apps/plasmon/src/os/README.md"), { force: true });
    rmSync(resolve(root, "apps/plasmon/src/os/AGENTS.md"), { force: true });
    const errors = validateDocumentationBoundaries(registry, root).join("\n");
    expect(errors).toContain("apps/plasmon/src/os: required README.md is missing");
    expect(errors).toContain("apps/plasmon/src/os: required local AGENTS.md is missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator rejects invalid inherited AGENTS ownership and unclassified children", () => {
  const root = createFixture();
  try {
    const registry = fixtureRegistry();
    mkdirSync(resolve(root, "apps/plasmon/src/native-apps"), { recursive: true });
    writeFileSync(resolve(root, "apps/plasmon/src/native-apps/AGENTS.md"), "# Native app rules\n");
    registry.boundaries[1].agents = {
      mode: "inherited",
      from: "apps/plasmon/src/native-apps/AGENTS.md",
    };
    mkdirSync(resolve(root, "apps/plasmon/src/os/new-subsystem"), { recursive: true });

    const errors = validateDocumentationBoundaries(registry, root).join("\n");
    expect(errors).toContain("apps/plasmon/src/os/sharing: inherited AGENTS owner");
    expect(errors).toContain("is not an ancestor");
    expect(errors).toContain("apps/plasmon/src/os/new-subsystem: unclassified direct child");
    expect(errors).toContain("add a boundary entry");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated boundary table is derived from the registry between stable markers", () => {
  const registry = fixtureRegistry();
  const stale = [
    "# Documentation",
    "",
    BOUNDARY_TABLE_START,
    "stale table",
    BOUNDARY_TABLE_END,
    "",
  ].join("\n");

  expect(validateDocumentationMap(stale, registry)).toHaveLength(1);
  const generated = replaceGeneratedBoundaryBlock(stale, registry);
  expect(validateDocumentationMap(generated, registry)).toEqual([]);
  expect(generated).toContain("| `apps/plasmon/src/os` | os-root | local | local |");
  expect(generated).toContain(
    "| `apps/plasmon/src/os/sharing` | os-subsystem | local | inherited from `apps/plasmon/src/os/AGENTS.md` |",
  );
});
