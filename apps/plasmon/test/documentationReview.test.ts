import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  computeOwnedFingerprint,
  documentationReviewStatus,
  nearestBoundaryForPath,
  parseReviewMarker,
  reviewDocumentationBoundary,
  upsertReviewMarker,
} from "../docs/documentation-review.mjs";

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

test("status stales only the nearest boundary and review refreshes its marker", () => {
  const registry = fixtureRegistry();
  const root = createFixture();
  try {
    const parentReview = reviewDocumentationBoundary("apps/plasmon/src/os", registry, root);
    const childReview = reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    expect(parentReview.changedFiles).toContain("apps/plasmon/src/os/service.ts");
    expect(childReview.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(documentationReviewStatus(registry, root).filter((entry) => entry.stale)).toEqual([]);

    git(root, ["add", "."]);
    git(root, ["commit", "-m", "review baseline"]);
    writeFileSync(resolve(root, "apps/plasmon/src/os/windowing/model.ts"), "export const model = 2;\n");
    git(root, ["add", "apps/plasmon/src/os/windowing/model.ts"]);
    git(root, ["commit", "-m", "change child"]);

    const stale = documentationReviewStatus(registry, root).filter((entry) => entry.stale);
    expect(stale.map((entry) => entry.boundary)).toEqual(["apps/plasmon/src/os/windowing"]);
    expect(stale[0]?.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");

    const refreshed = reviewDocumentationBoundary("apps/plasmon/src/os/windowing", registry, root);
    expect(refreshed.changedFiles).toContain("apps/plasmon/src/os/windowing/model.ts");
    expect(documentationReviewStatus(registry, root).filter((entry) => entry.stale)).toEqual([]);

    const marker = parseReviewMarker(readFileSync(resolve(root, "apps/plasmon/src/os/windowing/README.md"), "utf8"));
    expect(marker?.digest).toBe(refreshed.digest);
    expect(marker?.base).toBe(git(root, ["rev-parse", "HEAD"]));
  } finally {
    rmSync(root, { recursive: true, force: true });
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
