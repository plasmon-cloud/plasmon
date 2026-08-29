import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolvePackageProfile } from "../packageProfilePolicy.ts";

test("hackathon is explicit and slim is its exact compatibility composition", () => {
  const hackathon = resolvePackageProfile("hackathon");
  const slim = resolvePackageProfile("slim");

  expect(hackathon).toMatchObject({
    requestedProfile: "hackathon",
    canonicalProfile: "hackathon",
    isHackathon: true,
    isDemo: false,
    monacoProfile: "slim",
  });
  expect(slim).toMatchObject({
    requestedProfile: "slim",
    canonicalProfile: "hackathon",
    isHackathon: true,
    isDemo: false,
    monacoProfile: "slim",
  });
  expect({ ...slim, requestedProfile: "hackathon" }).toEqual(hackathon);
});

test("full and demo remain distinct from the Hackathon contract", () => {
  expect(resolvePackageProfile("full")).toMatchObject({
    canonicalProfile: "full",
    isHackathon: false,
    isDemo: false,
    monacoProfile: "full",
  });
  expect(resolvePackageProfile("demo")).toMatchObject({
    canonicalProfile: "demo",
    isHackathon: false,
    isDemo: true,
    monacoProfile: "slim",
  });
});

test("unknown package profiles fail closed before a build starts", () => {
  expect(() => resolvePackageProfile("hackathno")).toThrow(
    'Invalid PLASMON_PACKAGE_PROFILE "hackathno". Expected one of: hackathon, slim, full, demo.',
  );

  const result = spawnSync("bun", ["build.ts"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      PLASMON_PACKAGE_PROFILE: "hackathno",
    },
  });

  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'Invalid PLASMON_PACKAGE_PROFILE "hackathno"',
  );
});
