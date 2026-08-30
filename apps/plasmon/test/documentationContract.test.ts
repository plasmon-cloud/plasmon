import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  defaultRepoRoot,
  docsMapRelativePath,
  generatedBoundaryBlock,
  loadDocumentationBoundaryRegistry,
  validateDocumentationBoundaries,
  validateDocumentationMap,
} from "../docs/documentation-boundaries.mjs";

const STRUCTURE_COMMAND = "npm --workspace neutron-plasmon run docs:boundaries:check";

export function documentationContractErrors(repoRoot = defaultRepoRoot) {
  const registry = loadDocumentationBoundaryRegistry(repoRoot);
  const structuralErrors = validateDocumentationBoundaries(registry, repoRoot);
  if (structuralErrors.length > 0) {
    return structuralErrors.map((error) => `${error}\n  inspect: ${STRUCTURE_COMMAND}`);
  }

  const docsMap = readFileSync(resolve(repoRoot, docsMapRelativePath), "utf8");
  return validateDocumentationMap(docsMap, registry);
}

test("documentation boundaries and generated index stay current", () => {
  expect(documentationContractErrors()).toEqual([]);
});

test("documentation contract failures include the structural repair command", () => {
  const structural = "apps/plasmon/src/os/example: unclassified direct child";
  expect(`${structural}\n  inspect: ${STRUCTURE_COMMAND}`).toContain(STRUCTURE_COMMAND);
});

test("implementation changes do not require documentation acknowledgement metadata", () => {
  const packageJson = JSON.parse(readFileSync(resolve(defaultRepoRoot, "apps/plasmon/package.json"), "utf8"));
  const docsMap = readFileSync(resolve(defaultRepoRoot, docsMapRelativePath), "utf8");

  expect(packageJson.scripts["docs:review"]).toBeUndefined();
  expect(packageJson.scripts["docs:review:status"]).toBeUndefined();
  expect(existsSync(resolve(defaultRepoRoot, "apps/plasmon/docs/documentation-review.mjs"))).toBe(false);
  expect(docsMap).not.toContain("DOCUMENTATION_REVIEW.md");
  expect(docsMap).not.toContain("docs:review");

  const root = mkdtempSync(resolve(tmpdir(), "plasmon-doc-contract-"));
  const appRoot = resolve(root, "apps/plasmon");
  const implementationPath = resolve(appRoot, "src/implementation.ts");
  const registry = {
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

  try {
    mkdirSync(resolve(appRoot, "docs"), { recursive: true });
    mkdirSync(resolve(appRoot, "src"), { recursive: true });
    writeFileSync(resolve(appRoot, "README.md"), "# Fixture application\n");
    writeFileSync(resolve(appRoot, "AGENTS.md"), "# Fixture rules\n");
    writeFileSync(implementationPath, "export const implementation = 1;\n");
    writeFileSync(
      resolve(appRoot, "docs/documentation-boundaries.json"),
      `${JSON.stringify(registry, null, 2)}\n`,
    );
    writeFileSync(resolve(appRoot, "docs/README.md"), `# Fixture map\n\n${generatedBoundaryBlock(registry)}\n`);

    expect(documentationContractErrors(root)).toEqual([]);
    writeFileSync(implementationPath, "export const implementation = 2;\n");
    expect(documentationContractErrors(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
