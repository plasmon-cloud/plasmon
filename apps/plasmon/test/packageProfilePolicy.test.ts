import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolvePackageProfile } from "../packageProfilePolicy.ts";

test("base is the ordinary default package composition", () => {
  expect(resolvePackageProfile(undefined, undefined)).toEqual({
    requestedProfile: "base",
    packageTier: "base",
    isSlim: false,
    demoOverlay: false,
    isDemo: false,
    monacoProfile: "base",
  });
});

test("slim remains an explicit constrained package composition", () => {
  expect(resolvePackageProfile("slim", undefined)).toEqual({
    requestedProfile: "slim",
    packageTier: "slim",
    isSlim: true,
    demoOverlay: false,
    isDemo: false,
    monacoProfile: "slim",
  });
});

test("demo is an overlay on Base rather than a package tier", () => {
  expect(resolvePackageProfile("base", "1")).toEqual({
    requestedProfile: "base",
    packageTier: "base",
    isSlim: false,
    demoOverlay: true,
    isDemo: true,
    monacoProfile: "base",
  });
  expect(resolvePackageProfile("base", "true").demoOverlay).toBe(true);
  expect(resolvePackageProfile("base", "0").demoOverlay).toBe(false);
  expect(resolvePackageProfile("base", "false").demoOverlay).toBe(false);
});

test("Slim rejects Demo overlay composition", () => {
  expect(() => resolvePackageProfile("slim", "1")).toThrow(
    "PLASMON_DEMO_OVERLAY cannot be enabled for the Slim package tier.",
  );
});

test("unknown and retired package profile names fail closed before a build starts", () => {
  for (const invalidProfile of ["silm", "hackathon", "core", "full", "demo"]) {
    expect(() => resolvePackageProfile(invalidProfile, undefined)).toThrow(
      `Invalid PLASMON_PACKAGE_PROFILE "${invalidProfile}". Expected one of: slim, base.`,
    );
  }

  expect(() => resolvePackageProfile("base", "yes")).toThrow(
    'Invalid PLASMON_DEMO_OVERLAY "yes". Expected one of: 0, 1, false, true.',
  );

  const result = spawnSync("bun", ["build.ts"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      PLASMON_PACKAGE_PROFILE: "full",
      PLASMON_DEMO_OVERLAY: "",
    },
  });

  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'Invalid PLASMON_PACKAGE_PROFILE "full"',
  );
});
