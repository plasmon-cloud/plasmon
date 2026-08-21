import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  manifestForPlasmonDeployment,
  resolveDeploymentArtifacts,
} from "../../../test/e2e/plasmon-deployment-environment.ts";

const repoRoot = resolve(import.meta.dir, "../../..");

interface PackageJson {
  scripts?: Record<string, string>;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("Plasmon local acceptance environment preparation", () => {
  test("fresh acceptance packaging is driven by the bounded local deployment manifest", async () => {
    const artifacts = await resolveDeploymentArtifacts({
      repoRoot,
      manifestPath: manifestForPlasmonDeployment("local"),
    });
    expect(artifacts.map(({ workspace }) => workspace)).toEqual([
      "neutron-kernel",
      "neutron-plasmon",
      "neutron-review",
    ]);
    for (const { archivePath } of artifacts) {
      expect(archivePath.endsWith(".neutron")).toBe(true);
    }

    const rootPackage = await readJson<PackageJson>(resolve(repoRoot, "package.json"));
    const prepare = rootPackage.scripts?.["plasmon:local:prepare"];
    const fresh = rootPackage.scripts?.["test:e2e:plasmon:fresh"] ?? "";

    expect(prepare).toBe("bun test/e2e/plasmon-deployment-environment.ts local prepare");
    expect(fresh).toContain("npm run plasmon:local:prepare");
    expect(fresh).toContain("npm run plasmon:local:reinstall");
    expect(fresh).not.toContain("plasmon:demo:");

    for (const { workspace } of artifacts) {
      expect(fresh).not.toContain(`--workspace ${workspace}`);
    }
  });
});
