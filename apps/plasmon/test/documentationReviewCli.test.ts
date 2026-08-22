import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeOwnedFingerprint,
  formatReviewMarker,
} from "../docs/documentation-review.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function git(root: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function createFixture() {
  const root = mkdtempSync(resolve(tmpdir(), "plasmon-doc-review-cli-"));
  for (const path of [
    "apps/plasmon/docs",
    "apps/plasmon/src/os",
    "apps/plasmon/src/os/windowing",
  ]) mkdirSync(resolve(root, path), { recursive: true });

  copyFileSync(
    resolve(appRoot, "docs/documentation-review.mjs"),
    resolve(root, "apps/plasmon/docs/documentation-review.mjs"),
  );
  copyFileSync(
    resolve(appRoot, "docs/documentation-boundaries.mjs"),
    resolve(root, "apps/plasmon/docs/documentation-boundaries.mjs"),
  );
  writeFileSync(
    resolve(root, "apps/plasmon/docs/documentation-boundaries.json"),
    `${JSON.stringify(fixtureRegistry(), null, 2)}\n`,
  );

  for (const path of ["apps/plasmon/src/os", "apps/plasmon/src/os/windowing"]) {
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

  const registry = fixtureRegistry();
  const base = git(root, ["rev-parse", "HEAD"]);
  for (const boundary of registry.boundaries) {
    const state = computeOwnedFingerprint(boundary.path, registry, root);
    const readmePath = resolve(root, boundary.path, "README.md");
    writeFileSync(
      readmePath,
      `${readFileSync(readmePath, "utf8").trimEnd()}\n\n${formatReviewMarker(state.digest, base)}\n`,
    );
  }
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "review baseline"]);
  return root;
}

function runStatus(root: string) {
  return spawnSync(
    process.execPath,
    ["apps/plasmon/docs/documentation-review.mjs", "status"],
    { cwd: root, encoding: "utf8" },
  );
}

test("documentation review status CLI reports stale/current output and exit status", () => {
  const root = createFixture();
  try {
    writeFileSync(resolve(root, "apps/plasmon/src/os/windowing/model.ts"), "export const model = 2;\n");
    git(root, ["add", "apps/plasmon/src/os/windowing/model.ts"]);
    git(root, ["commit", "-m", "change child"]);

    const stale = runStatus(root);
    expect(stale.status).toBe(1);
    expect(stale.stdout).toBe("");
    expect(stale.stderr).toContain("STALE apps/plasmon/src/os/windowing: owned implementation changed");
    expect(stale.stderr).toContain("  - apps/plasmon/src/os/windowing/model.ts");
    expect(stale.stderr).toContain(
      "  run: npm --workspace neutron-plasmon run docs:review -- apps/plasmon/src/os/windowing",
    );
    expect(stale.stderr).not.toContain("STALE apps/plasmon/src/os:");

    const registry = fixtureRegistry();
    const state = computeOwnedFingerprint("apps/plasmon/src/os/windowing", registry, root);
    const readmePath = resolve(root, "apps/plasmon/src/os/windowing/README.md");
    writeFileSync(
      readmePath,
      readFileSync(readmePath, "utf8").replace(
        /<!-- plasmon-docs-review:v1 sha256=[0-9a-f]{64} base=[0-9a-f]{40} -->/,
        formatReviewMarker(state.digest, git(root, ["rev-parse", "HEAD"])),
      ),
    );

    const current = runStatus(root);
    expect(current.status).toBe(0);
    expect(current.stderr).toBe("");
    expect(current.stdout).toContain("Documentation review fingerprints current: 2 boundaries.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
