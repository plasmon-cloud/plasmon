import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");

interface DeploymentManifest {
  artifacts: {
    kernel: { path: string };
    packages: Array<{ path: string }>;
  };
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function requiredWorkspacesFromManifest(): Promise<string[]> {
  const manifest = await readJson<DeploymentManifest>(
    resolve(repoRoot, "plasmon-local.ndeploy.json"),
  );
  const artifactPaths = [
    manifest.artifacts.kernel.path,
    ...manifest.artifacts.packages.map((artifact) => artifact.path),
  ];

  return Promise.all(
    artifactPaths.map(async (artifactPath) => {
      const packageJson = await readJson<PackageJson>(
        resolve(repoRoot, dirname(artifactPath), "package.json"),
      );
      if (!packageJson.name) {
        throw new Error(`Deployment artifact workspace has no package name: ${artifactPath}`);
      }
      return packageJson.name;
    }),
  );
}

describe("Plasmon installed demo environment preparation", () => {
  test("fresh acceptance packaging is driven by the deployment manifest", async () => {
    const requiredWorkspaces = await requiredWorkspacesFromManifest();
    expect(requiredWorkspaces).toEqual([
      "neutron-kernel",
      "neutron-plasmon",
      "neutron-review",
    ]);

    const rootPackage = await readJson<PackageJson>(resolve(repoRoot, "package.json"));
    const prepare = rootPackage.scripts?.["plasmon:demo:prepare"];
    const fresh = rootPackage.scripts?.["test:e2e:plasmon:fresh"] ?? "";

    expect(prepare).toBe("bun test/e2e/plasmon-demo-environment.ts prepare");
    expect(fresh).toContain("npm run plasmon:demo:prepare");

    for (const workspace of requiredWorkspaces) {
      expect(fresh).not.toContain(`--workspace ${workspace}`);
    }
  });
});
