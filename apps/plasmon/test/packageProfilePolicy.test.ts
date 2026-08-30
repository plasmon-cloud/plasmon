import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolvePackageProfile } from "../packageProfilePolicy.ts";

test("slim is the explicit constrained package composition", () => {
  expect(resolvePackageProfile("slim")).toMatchObject({
    requestedProfile: "slim",
    isSlim: true,
    isDemo: false,
    monacoProfile: "slim",
  });
});

test("full and demo remain distinct from the Slim contract until Base migration", () => {
  expect(resolvePackageProfile("full")).toMatchObject({
    requestedProfile: "full",
    isSlim: false,
    isDemo: false,
    monacoProfile: "full",
  });
  expect(resolvePackageProfile("demo")).toMatchObject({
    requestedProfile: "demo",
    isSlim: false,
    isDemo: true,
    monacoProfile: "slim",
  });
});

test("unknown and retired package profile names fail closed before a build starts", () => {
  for (const invalidProfile of ["silm", "hackathon", "core"]) {
    expect(() => resolvePackageProfile(invalidProfile)).toThrow(
      `Invalid PLASMON_PACKAGE_PROFILE "${invalidProfile}". Expected one of: slim, full, demo.`,
    );
  }

  const result = spawnSync("bun", ["build.ts"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      PLASMON_PACKAGE_PROFILE: "silm",
    },
  });

  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'Invalid PLASMON_PACKAGE_PROFILE "silm"',
  );
});
