import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveDemoArtifacts } from "../../../test/e2e/plasmon-demo-environment.ts";

const repoRoot = resolve(import.meta.dir, "../../..");

interface PackageJson {
  scripts?: Record<string, string>;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("Plasmon installed demo environment preparation", () => {
  test("fresh acceptance packaging is driven by the deployment manifest", async () => {
    const artifacts = await resolveDemoArtifacts({ repoRoot });
    expect(
      artifacts.map(({ archivePath, workspace }) => ({ archivePath, workspace })),
    ).toEqual([
      {
        archivePath: "apps/kernel/neutron-kernel.neutron",
        workspace: "neutron-kernel",
      },
      {
        archivePath: "apps/plasmon/neutron-plasmon.neutron",
        workspace: "neutron-plasmon",
      },
      {
        archivePath: "apps/review/neutron-review.neutron",
        workspace: "neutron-review",
      },
    ]);

    const rootPackage = await readJson<PackageJson>(resolve(repoRoot, "package.json"));
    const prepare = rootPackage.scripts?.["plasmon:demo:prepare"];
    const fresh = rootPackage.scripts?.["test:e2e:plasmon:fresh"] ?? "";

    expect(prepare).toBe("bun test/e2e/plasmon-demo-environment.ts prepare");
    expect(fresh).toContain("npm run plasmon:demo:prepare");

    for (const { workspace } of artifacts) {
      expect(fresh).not.toContain(`--workspace ${workspace}`);
    }
  });
});
