import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultRepoRoot,
  docsMapRelativePath,
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

test("documentation automation does not require whole-tree review fingerprints", () => {
  const packageJson = JSON.parse(readFileSync(resolve(defaultRepoRoot, "apps/plasmon/package.json"), "utf8"));
  const docsMap = readFileSync(resolve(defaultRepoRoot, docsMapRelativePath), "utf8");

  expect(packageJson.scripts["docs:review"]).toBeUndefined();
  expect(packageJson.scripts["docs:review:status"]).toBeUndefined();
  expect(existsSync(resolve(defaultRepoRoot, "apps/plasmon/docs/documentation-review.mjs"))).toBe(false);
  expect(docsMap).not.toContain("DOCUMENTATION_REVIEW.md");
  expect(docsMap).not.toContain("docs:review");
});
