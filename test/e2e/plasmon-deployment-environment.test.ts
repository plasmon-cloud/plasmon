import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEPLOYMENT_BUILD_PREREQUISITES,
  manifestForPlasmonDeployment,
  packageProfileForDeployment,
  PLASMON_DEMO_MANIFEST,
  PLASMON_LOCAL_MANIFEST,
  PLASMON_WORKSPACE,
  resolveDeploymentArtifacts,
  workspacesToPackage,
} from "./plasmon-deployment-environment.ts";

interface InlineManifest {
  artifacts: {
    kind: "inline";
    kernel: { path: string };
    packages: Array<{ path: string }>;
  };
}

const repoRoot = resolve(import.meta.dir, "../..");

async function declaredArtifactPaths(manifestPath: string): Promise<string[]> {
  const manifest = JSON.parse(
    await readFile(resolve(repoRoot, manifestPath), "utf8"),
  ) as InlineManifest;
  return [
    manifest.artifacts.kernel.path,
    ...manifest.artifacts.packages.map((artifact) => artifact.path),
  ];
}

describe("Plasmon deployment command semantics", () => {
  test("public local and demo scripts bind to explicit deployment scopes", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(repoRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    for (const command of ["prepare", "serve", "reinstall", "status"]) {
      expect(packageJson.scripts[`plasmon:local:${command}`]).toBe(
        `bun test/e2e/plasmon-deployment-environment.ts local ${command}`,
      );
      expect(packageJson.scripts[`plasmon:demo:${command}`]).toBe(
        `bun test/e2e/plasmon-deployment-environment.ts demo ${command}`,
      );
    }
  });

  test("local and demo scopes select different canonical manifests", () => {
    expect(manifestForPlasmonDeployment("local")).toBe(PLASMON_LOCAL_MANIFEST);
    expect(manifestForPlasmonDeployment("demo")).toBe(PLASMON_DEMO_MANIFEST);
    expect(PLASMON_LOCAL_MANIFEST).toBe("plasmon-local.ndeploy.json");
    expect(PLASMON_DEMO_MANIFEST).toBe("plasmon.ndeploy.json");
  });

  test("clean-checkout preparation materializes generated shared UI exports first", async () => {
    expect([...DEPLOYMENT_BUILD_PREREQUISITES]).toEqual(["neutron-design-system"]);
    const designSystemPackageJson = JSON.parse(
      await readFile(resolve(repoRoot, "packages/neutron-design-system/package.json"), "utf8"),
    ) as { exports: Record<string, { import?: string }>; scripts: Record<string, string> };
    expect(designSystemPackageJson.exports["."]?.import).toBe("./dist/classes.js");
    expect(designSystemPackageJson.scripts.build).toBeTruthy();
  });

  test("demo preparation reuses the normal Plasmon package command with the existing demo profile", async () => {
    const plasmonPackageJson = JSON.parse(
      await readFile(resolve(repoRoot, "apps/plasmon/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(plasmonPackageJson.scripts.package).toContain("npm run build");
    expect(plasmonPackageJson.scripts["package:demo"]).toBeUndefined();
    expect(packageProfileForDeployment(PLASMON_DEMO_MANIFEST, PLASMON_WORKSPACE)).toBe("demo");
    expect(packageProfileForDeployment(PLASMON_LOCAL_MANIFEST, PLASMON_WORKSPACE)).toBeUndefined();
    expect(packageProfileForDeployment(PLASMON_DEMO_MANIFEST, "neutron-kernel")).toBeUndefined();
  });

  test("demo preparation resolves every artifact declared by plasmon.ndeploy.json", async () => {
    const expected = await declaredArtifactPaths(PLASMON_DEMO_MANIFEST);
    const actual = await resolveDeploymentArtifacts({
      repoRoot,
      manifestPath: manifestForPlasmonDeployment("demo"),
    });
    const archivePaths = actual.map((artifact) => artifact.archivePath);

    expect(archivePaths).toEqual(expected);
    expect(archivePaths).toContain("apps/plasmon/plasmon.v0.1.0.neutron");
    expect(archivePaths).toContain("apps/review/review.v0.1.0.neutron");
    expect(
      archivePaths.filter(
        (archivePath) => archivePath === "apps/review/review.v0.1.0.neutron",
      ),
    ).toHaveLength(1);
    expect(actual.length).toBeGreaterThan(3);
  });

  test("local preparation resolves only every artifact declared by plasmon-local.ndeploy.json", async () => {
    const expected = await declaredArtifactPaths(PLASMON_LOCAL_MANIFEST);
    const actual = await resolveDeploymentArtifacts({
      repoRoot,
      manifestPath: manifestForPlasmonDeployment("local"),
    });

    expect(actual.map((artifact) => artifact.archivePath)).toEqual(expected);
    expect(actual.map((artifact) => artifact.archivePath)).toEqual([
      "apps/kernel/kernel.v0.3.6.neutron",
      "apps/plasmon/plasmon.v0.1.0.neutron",
      "apps/review/review.v0.1.1.neutron",
    ]);
  });

  test("packaging deduplicates workspaces without dropping declared archives", () => {
    const artifacts = [
      {
        archivePath: "apps/example/a.neutron",
        workspace: "neutron-example",
        workspaceDirectory: resolve(repoRoot, "apps/example"),
      },
      {
        archivePath: "apps/example/b.neutron",
        workspace: "neutron-example",
        workspaceDirectory: resolve(repoRoot, "apps/example"),
      },
      {
        archivePath: "apps/other/c.neutron",
        workspace: "neutron-other",
        workspaceDirectory: resolve(repoRoot, "apps/other"),
      },
    ];

    expect(artifacts.map((artifact) => artifact.archivePath)).toHaveLength(3);
    expect(workspacesToPackage(artifacts)).toEqual([
      "neutron-example",
      "neutron-other",
    ]);
  });
});
