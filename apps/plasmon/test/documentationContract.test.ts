import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultRepoRoot,
  docsMapRelativePath,
  loadDocumentationBoundaryRegistry,
  validateDocumentationBoundaries,
  validateDocumentationMap,
} from "../docs/documentation-boundaries.mjs";
import { documentationReviewStatus } from "../docs/documentation-review.mjs";

const STRUCTURE_COMMAND = "npm --workspace neutron-plasmon run docs:boundaries:check";
const REVIEW_COMMAND = "npm --workspace neutron-plasmon run docs:review --";

export function documentationContractErrors(repoRoot = defaultRepoRoot) {
  const registry = loadDocumentationBoundaryRegistry(repoRoot);
  const structuralErrors = validateDocumentationBoundaries(registry, repoRoot);
  if (structuralErrors.length > 0) {
    return structuralErrors.map((error) => `${error}\n  inspect: ${STRUCTURE_COMMAND}`);
  }

  const docsMap = readFileSync(resolve(repoRoot, docsMapRelativePath), "utf8");
  const errors = [...validateDocumentationMap(docsMap, registry)];

  for (const entry of documentationReviewStatus(registry, repoRoot).filter((status) => status.stale)) {
    const changed = entry.changedFiles.length > 0
      ? `\n${entry.changedFiles.map((path) => `  - ${path}`).join("\n")}`
      : "";
    errors.push(
      `${entry.boundary}: documentation review fingerprint is stale.${changed}\n  sha256=${entry.digest}\n  review: ${REVIEW_COMMAND} ${entry.boundary}`,
    );
  }

  return errors;
}

test("documentation boundaries, generated index, and review fingerprints stay current", () => {
  expect(documentationContractErrors()).toEqual([]);
});

test("documentation contract failures include actionable repair commands", () => {
  const structural = "apps/plasmon/src/os/example: unclassified direct child";
  expect(`${structural}\n  inspect: ${STRUCTURE_COMMAND}`).toContain(STRUCTURE_COMMAND);

  const stale = `apps/plasmon/src/os/windowing: documentation review fingerprint is stale.\n  sha256=${"0".repeat(64)}\n  review: ${REVIEW_COMMAND} apps/plasmon/src/os/windowing`;
  expect(stale).toContain(`${REVIEW_COMMAND} apps/plasmon/src/os/windowing`);
  expect(stale).toContain(`sha256=${"0".repeat(64)}`);
});
