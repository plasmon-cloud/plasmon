import { expect, spyOn, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentationBoundaryRegistry } from "../docs/documentation-boundaries.mjs";
import {
  computeOwnedFingerprint,
  documentationMaintenanceSinceReview,
  documentationReviewStatus,
  nearestBoundaryForPath,
  parseReviewMarker,
  printStatus,
  reviewDocumentationBoundary,
  upsertReviewMarker,
} from "../docs/documentation-review.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "../..");

function git(root: string, args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function fixtureRegistry() {
  return {
    schema: "plasmon-documentation-boundaries-v1",
    root: "apps/plasmon",
    discoveryRoots: [],
    boundaries: [
      {
        path: "apps/plasmon/src/os",
        kind: "os-root",
        readme: "local",
        agents: { mode: "local" },
      },
      {
        path: "apps/plasmon/src/os/windowing",
        kind: "os-subsystem",
        readme: "local",
        agents: { mode: "local" },
      },
    ],
  };
}

function createFixture() {
  const root = mkdtempSync(resolve(tmpdir(), "plasmon-doc-review-"));
  for (const path of ["apps/plasmon/src/os", "apps/plasmon/src/os/windowing"]) {
    mkdirSync(resolve(root, path), { recursive: true });
    writeFileSync(resolve(root, path, "README.md"), `# ${path}\n`);
    writeFileSync(resolve(root, path, "AGENTS.md"), `# rules for ${path}\n`);
  }
  writeFileSync(resolve(root, "apps/plasmon/src/os/service.ts"), "export const service = 1;\n");
  writeFileSync(resolve(root, "apps/plasmon/src/os/windowing/model.ts"), "export const model = 1;\n");

  git(root, ["init"]);
  git(root, ["config", "user.email", "docs@example.invalid"]);
  git(root, ["config", "user.name", "Docs Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixture"]);
  return root;
}

test("nearest-boundary ownership excludes nested implementation from its parent", () => {
  const registry = fixtureRegistry();
  expect(nearestBoundaryForPath("apps/plasmon/src/os/service.ts", registry)?.path).toBe("apps/plasmon/src/os");
  expect(nearestBoundaryForPath("apps/plasmon/src/os/windowing/model.ts", registry)?.path).toBe(
    "apps/plasmon/src/os/windowing",
  );

  const root = createFixture();
  try {
    const parentBefore = computeOwnedFingerprint("apps/plasmon/src/os", registry, root);
    const childBefore = computeOwnedFingerprint("apps/plasmon/src/os/windowing", registry, root);
    writeFileSync(resolve(root, "apps/plasmon/src/os/windowing/model.ts"), "export const model = 2;\n");
    const parentAfter = computeOwnedFingerprint("apps/plasmon/src/os", registry, root);
    const childAfter = computeOwnedFingerprint("apps/plasmon/src/os/windowing", registry, root);

    expect(parentAfter.digest).toBe(parentBefore.digest);
    expect(childAfter.digest).not.toBe(childBefore.digest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fingerprints are deterministic and documentation markers do not recurse", () => {
  const registry = fixtureRegistry();
  const root = createFixture();
  try {
    const before = computeOwnedFingerprint("apps/plasmon/src/os", registry, root);
    const readmePath = resolve(root, "apps/plasmon/src/os/README.md");
    const readme = readFileSync(readmePath, "utf8");
    writeFileSync(readmePath, upsertReviewMarker(readme, "0".repeat(64), git(root, ["rev-parse", "HEAD"])));
    const afterMarker = computeOwnedFingerprint("apps/plasmon/src/os", registry, root);
    expect(afterMarker.digest).toBe(before.digest);

    writeFileSync(readmePath, `${readFileSync(readmePath, "utf8")}\nExtra documentation.\n`);
    const afterProse = computeOwnedFingerprint("apps/plasmon/src/os", registry, root);
    expect(afterProse.digest).toBe(before.digest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status stales only the nearest boundary and review requires committed owning documentation maintenance", () => {
  const registry = fixtureRegistry();
  const root = createFixture();
  try {
    const parentReview = reviewDocumentationBoundary("apps/plasmon/src/os", registry, root);
    const childReadmePath = resolve(root, "apps/plasmon/src/os/windowing/README.md");
    let previewed = false;
    const childReview = reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root, {
      beforeWrite(review) {
        previewed = true;
        expect(parseReviewMarker(readFileSync(childReadmePath, "utf8"))).toBeNull();
        expect(review.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
      },
    });
    expect(previewed).toBe(true);
    expect(parentReview.changedFiles).toContain("apps/plasmon/src/os/service.ts");
    expect(childReview.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(documentationReviewStatus(registry, root).filter((entry) => entry.stale)).toEqual([]);

    git(root, ["add", "."]);
    git(root, ["commit", "-m", "review baseline"]);
    writeFileSync(resolve(root, "apps/plasmon/src/os/windowing/model.ts"), "export const model = 2;\n");
    git(root, ["add", "apps/plasmon/src/os/windowing/model.ts"]);
    git(root, ["commit", "-m", "change child"]);
    const implementationCommit = git(root, ["rev-parse", "HEAD"]);

    const stale = documentationReviewStatus(registry, root).filter((entry) => entry.stale);
    expect(stale.map((entry) => entry.boundary)).toEqual(["apps/plasmon/src/os/windowing"]);
    expect(stale[0]?.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(stale[0]?.documentationChanged).toBe(false);
    expect(stale[0]?.latestImplementationCommit).toBe(implementationCommit);
    expect(stale[0]?.requiredDocumentationFiles).toEqual([
      "apps/plasmon/src/os/windowing/README.md",
      "apps/plasmon/src/os/windowing/AGENTS.md",
    ]);

    expect(() => reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root)).toThrow(
      "no committed substantive owning-documentation edit exists at or after the latest owned implementation commit",
    );

    writeFileSync(
      childReadmePath,
      `${readFileSync(childReadmePath, "utf8").trimEnd()}\n\nDocument the changed windowing behavior.\n`,
    );
    expect(() => reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root)).toThrow(
      "commit the owned implementation/documentation change surface before refreshing the marker",
    );

    git(root, ["add", "apps/plasmon/src/os/windowing/README.md"]);
    git(root, ["commit", "-m", "document child change"]);
    const documentationCommit = git(root, ["rev-parse", "HEAD"]);

    const refreshed = reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    expect(refreshed.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(refreshed.documentationChangedFiles).toEqual(["apps/plasmon/src/os/windowing/README.md"]);
    expect(refreshed.latestImplementationCommit).toBe(implementationCommit);
    expect(refreshed.latestDocumentationCommit).toBe(documentationCommit);
    expect(documentationReviewStatus(registry, root).filter((entry) => entry.stale)).toEqual([]);

    const marker = parseReviewMarker(readFileSync(childReadmePath, "utf8"));
    expect(marker?.digest).toBe(refreshed.digest);
    expect(marker?.base).toBe(documentationCommit);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("deleted implementation still requires documentation committed after the deletion", () => {
  const registry = fixtureRegistry();
  const root = createFixture();
  try {
    reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "review baseline"]);

    const readmePath = resolve(root, "apps/plasmon/src/os/windowing/README.md");
    writeFileSync(
      readmePath,
      `${readFileSync(readmePath, "utf8").trimEnd()}\n\nDocument the planned model retirement.\n`,
    );
    git(root, ["add", "apps/plasmon/src/os/windowing/README.md"]);
    git(root, ["commit", "-m", "document planned retirement"]);
    const earlyDocumentationCommit = git(root, ["rev-parse", "HEAD"]);

    const modelPath = resolve(root, "apps/plasmon/src/os/windowing/model.ts");
    rmSync(modelPath);
    const boundary = registry.boundaries.find((entry) => entry.path === "apps/plasmon/src/os/windowing")!;
    const marker = parseReviewMarker(readFileSync(readmePath, "utf8"));
    expect(marker).not.toBeNull();
    expect(() => reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root)).toThrow(
      "commit the owned implementation/documentation change surface before refreshing the marker",
    );

    git(root, ["add", "-A", "apps/plasmon/src/os/windowing/model.ts"]);
    git(root, ["commit", "-m", "delete child implementation"]);
    const deletionCommit = git(root, ["rev-parse", "HEAD"]);

    const maintenance = documentationMaintenanceSinceReview(boundary, marker, registry, root);
    expect(maintenance.baselineAvailable).toBe(true);
    expect(maintenance.changed).toBe(false);
    expect(maintenance.latestImplementationCommit).toBe(deletionCommit);
    expect(maintenance.latestDocumentationCommit).toBeNull();
    expect(earlyDocumentationCommit).not.toBe(deletionCommit);

    const stale = documentationReviewStatus(registry, root).find(
      (entry) => entry.boundary === "apps/plasmon/src/os/windowing",
    );
    expect(stale?.stale).toBe(true);
    expect(stale?.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(stale?.latestImplementationCommit).toBe(deletionCommit);
    expect(stale?.documentationChanged).toBe(false);
    expect(() => reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root)).toThrow(
      "no committed substantive owning-documentation edit exists at or after the latest owned implementation commit",
    );

    writeFileSync(
      readmePath,
      `${readFileSync(readmePath, "utf8").trimEnd()}\n\nRecord the completed model retirement.\n`,
    );
    git(root, ["add", "apps/plasmon/src/os/windowing/README.md"]);
    git(root, ["commit", "-m", "document completed retirement"]);
    const finalDocumentationCommit = git(root, ["rev-parse", "HEAD"]);

    const refreshed = reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    expect(refreshed.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(refreshed.latestImplementationCommit).toBe(deletionCommit);
    expect(refreshed.latestDocumentationCommit).toBe(finalDocumentationCommit);
    expect(refreshed.documentationChangedFiles).toEqual(["apps/plasmon/src/os/windowing/README.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("machine marker commits do not count as substantive documentation maintenance", () => {
  const registry = fixtureRegistry();
  const root = createFixture();
  try {
    reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "review baseline"]);

    const modelPath = resolve(root, "apps/plasmon/src/os/windowing/model.ts");
    writeFileSync(modelPath, "export const model = 2;\n");
    git(root, ["add", "apps/plasmon/src/os/windowing/model.ts"]);
    git(root, ["commit", "-m", "change child"]);
    const implementationCommit = git(root, ["rev-parse", "HEAD"]);

    const readmePath = resolve(root, "apps/plasmon/src/os/windowing/README.md");
    const marker = parseReviewMarker(readFileSync(readmePath, "utf8"));
    expect(marker).not.toBeNull();
    writeFileSync(
      readmePath,
      upsertReviewMarker(readFileSync(readmePath, "utf8"), marker!.digest, implementationCommit),
    );
    git(root, ["add", "apps/plasmon/src/os/windowing/README.md"]);
    git(root, ["commit", "-m", "marker only"]);

    const forgedMarker = parseReviewMarker(readFileSync(readmePath, "utf8"));
    expect(forgedMarker).not.toBeNull();
    const boundary = registry.boundaries.find((entry) => entry.path === "apps/plasmon/src/os/windowing")!;
    const maintenance = documentationMaintenanceSinceReview(boundary, forgedMarker, registry, root);
    expect(maintenance.baselineAvailable).toBe(true);
    expect(maintenance.changed).toBe(false);
    expect(maintenance.changedFiles).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status formatter emits actionable stale output and a nonzero result", () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    const result = printStatus([
      {
        boundary: "apps/plasmon/src/os/windowing",
        digest: "1".repeat(64),
        marker: { digest: "0".repeat(64), base: "2".repeat(40) },
        stale: true,
        changedFiles: ["apps/plasmon/src/os/windowing/model.ts"],
        documentationBaselineAvailable: true,
        documentationChanged: false,
        documentationChangedFiles: [],
        requiredDocumentationFiles: [
          "apps/plasmon/src/os/windowing/README.md",
          "apps/plasmon/src/os/windowing/AGENTS.md",
        ],
        latestImplementationCommit: "3".repeat(40),
        latestDocumentationCommit: null,
        uncommittedReviewFiles: [],
      },
    ]);

    expect(result).toBe(1);
    expect(error).toHaveBeenCalledWith("STALE apps/plasmon/src/os/windowing: owned implementation changed");
    expect(error).toHaveBeenCalledWith("  - apps/plasmon/src/os/windowing/model.ts");
    expect(error).toHaveBeenCalledWith(
      "  required committed documentation edit: apps/plasmon/src/os/windowing/README.md or apps/plasmon/src/os/windowing/AGENTS.md",
    );
    expect(error).toHaveBeenCalledWith(
      "  run: npm --workspace neutron-plasmon run docs:review -- apps/plasmon/src/os/windowing",
    );
    expect(log).not.toHaveBeenCalled();

    error.mockClear();
    log.mockClear();
    expect(printStatus([
      {
        boundary: "apps/plasmon/src/os/windowing",
        digest: "1".repeat(64),
        marker: { digest: "1".repeat(64), base: "2".repeat(40) },
        stale: false,
        changedFiles: [],
        documentationBaselineAvailable: true,
        documentationChanged: false,
        documentationChangedFiles: [],
        requiredDocumentationFiles: [
          "apps/plasmon/src/os/windowing/README.md",
          "apps/plasmon/src/os/windowing/AGENTS.md",
        ],
        latestImplementationCommit: null,
        latestDocumentationCommit: null,
        uncommittedReviewFiles: [],
      },
    ])).toBe(0);
    expect(log).toHaveBeenCalledWith("Documentation review fingerprints current: 1 boundaries.");
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
    log.mockRestore();
  }
});

test("equivalent working trees produce the same fingerprint", () => {
  const registry = fixtureRegistry();
  const left = createFixture();
  const right = createFixture();
  try {
    expect(computeOwnedFingerprint("apps/plasmon/src/os/windowing", registry, left).digest).toBe(
      computeOwnedFingerprint("apps/plasmon/src/os/windowing", registry, right).digest,
    );
  } finally {
    rmSync(left, { recursive: true, force: true });
    rmSync(right, { recursive: true, force: true });
  }
});

test("current repository review fingerprints are computable", () => {
  const registry = loadDocumentationBoundaryRegistry(repoRoot);
  const status = documentationReviewStatus(registry, repoRoot);
  expect(status).toHaveLength(registry.boundaries.length);
  expect(status.every((entry) => /^[0-9a-f]{64}$/.test(entry.digest))).toBe(true);

  if (status.some((entry) => entry.marker === null)) {
    console.log(
      `DOCUMENTATION_REVIEW_BASELINES=${JSON.stringify(
        status.map((entry) => ({ boundary: entry.boundary, digest: entry.digest })),
      )}`,
    );
  }
  if (status.some((entry) => entry.stale)) {
    console.log(
      `DOCUMENTATION_REVIEW_STALE=${JSON.stringify(
        status.filter((entry) => entry.stale).map((entry) => ({ boundary: entry.boundary, digest: entry.digest })),
      )}`,
    );
  }
});
