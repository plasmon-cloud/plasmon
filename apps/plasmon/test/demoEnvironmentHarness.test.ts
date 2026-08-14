import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { packageArchiveFilename } from "../../../packages/neutron-tools/src/package_archive.ts";
import { resolveDemoArtifacts } from "../../../test/e2e/plasmon-demo-environment.ts";

const repoRoot = resolve(import.meta.dir, "../../..");

interface PackageJson {
  scripts?: Record<string, string>;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeWorkspace(
  fixtureRoot: string,
  directory: string,
  workspace: string,
  id: string,
  version: number,
): Promise<void> {
  const workspaceDirectory = resolve(fixtureRoot, directory);
  await mkdir(workspaceDirectory, { recursive: true });
  await writeFile(
    resolve(workspaceDirectory, "package.json"),
    JSON.stringify({
      name: workspace,
      scripts: { package: "echo package" },
    }),
  );
  await writeFile(
    resolve(workspaceDirectory, "neutron.json"),
    JSON.stringify({ id, version }),
  );
}

describe("Plasmon installed demo environment preparation", () => {
  test("fresh acceptance packaging is driven by the deployment manifest", async () => {
    const artifacts = await resolveDemoArtifacts({ repoRoot });
    expect(artifacts.map(({ workspace }) => workspace)).toEqual([
      "neutron-kernel",
      "neutron-plasmon",
      "neutron-review",
    ]);
    for (const { archivePath } of artifacts) {
      expect(archivePath.endsWith(".neutron")).toBe(true);
    }

    const rootPackage = await readJson<PackageJson>(resolve(repoRoot, "package.json"));
    const prepare = rootPackage.scripts?.["plasmon:demo:prepare"];
    const fresh = rootPackage.scripts?.["test:e2e:plasmon:fresh"] ?? "";

    expect(prepare).toBe("bun test/e2e/plasmon-demo-environment.ts prepare");
    expect(fresh).toContain("npm run plasmon:demo:prepare");

    for (const { workspace } of artifacts) {
      expect(fresh).not.toContain(`--workspace ${workspace}`);
    }
  });

  test("archive paths follow the owning workspace manifest version", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "plasmon-demo-environment-"));
    try {
      await writeWorkspace(fixtureRoot, "apps/kernel", "neutron-kernel", "kernel", 100);
      await writeWorkspace(fixtureRoot, "apps/plasmon", "neutron-plasmon", "plasmon", 101);
      await writeFile(
        resolve(fixtureRoot, "demo.ndeploy.json"),
        JSON.stringify({
          artifacts: {
            kind: "inline",
            kernel: { path: "apps/kernel/kernel.v0.1.0.neutron" },
            packages: [{ path: "apps/plasmon/plasmon.v0.1.0.neutron" }],
          },
        }),
      );

      const artifacts = await resolveDemoArtifacts({
        repoRoot: fixtureRoot,
        manifestPath: "demo.ndeploy.json",
      });

      expect(artifacts.map(({ archivePath }) => archivePath)).toEqual([
        `apps/kernel/${packageArchiveFilename("kernel", 100)}`,
        `apps/plasmon/${packageArchiveFilename("plasmon", 101)}`,
      ]);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
