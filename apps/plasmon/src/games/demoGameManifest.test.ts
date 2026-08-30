import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createPlasmonDemoGameBundle } from "./demoFixtureBundle.ts";
import { DEMO_GAME_FIXTURE_PATH, DEMO_NES_LICENSE_PATH, DEMO_NES_PATH } from "./demoFixture.ts";
import { createPlasmonNesDemoRom } from "./demoNesBundle.ts";
import {
  DEMO_GAME_MANIFEST,
  validateDemoGameManifest,
  type DemoGameManifest,
} from "./demoGameManifest.ts";

const knownRuntimes = new Set(["js-dos", "emulatorjs"]);
const demoRuntimes = new Set(["js-dos", "emulatorjs"]);

function sri(bytes: Uint8Array): string {
  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

test("Demo manifest binds both repository-authored games to exact legal metadata", () => {
  expect(() => validateDemoGameManifest(DEMO_GAME_MANIFEST, {
    knownRuntimeIds: knownRuntimes,
    selectedRuntimeIds: demoRuntimes,
  })).not.toThrow();

  expect(DEMO_GAME_MANIFEST.entries).toHaveLength(2);
  const jsDos = DEMO_GAME_MANIFEST.entries.find(({ id }) => id === "plasmon-demo-jsdos")!;
  const nes = DEMO_GAME_MANIFEST.entries.find(({ id }) => id === "plasmon-demo-nes")!;
  const jsDosBundle = createPlasmonDemoGameBundle();
  const nesRom = createPlasmonNesDemoRom();

  expect(jsDos).toMatchObject({
    filesystemPath: DEMO_GAME_FIXTURE_PATH,
    expectedRuntime: "js-dos",
    measuredBytes: jsDosBundle.byteLength,
    disposition: "bundled",
    redistribution: { license: "GPL-3.0-only" },
  });
  expect(jsDos.source.digest).toBe(sri(jsDosBundle));
  expect(jsDos.source.pin).toMatch(/^git-blob:[0-9a-f]{40}$/u);

  expect(nes).toMatchObject({
    filesystemPath: DEMO_NES_PATH,
    expectedRuntime: "emulatorjs",
    measuredBytes: nesRom.byteLength,
    disposition: "bundled",
    redistribution: {
      license: "GPL-3.0-only",
      attributionPath: DEMO_NES_LICENSE_PATH,
    },
  });
  expect(nes.source).toMatchObject({
    location: "apps/plasmon/src/games/demoNesBundle.ts",
    pin: "git-blob:3174446a0b612454c3548888d02c019b894bf36b",
    digest: sri(nesRom),
  });
  expect(jsDos.redistribution.basis).toContain("Repository-authored");
  expect(nes.redistribution.basis).toContain("Repository-authored");
});

test("Demo manifest fails closed for unknown or omitted required runtime", () => {
  expect(() => validateDemoGameManifest(DEMO_GAME_MANIFEST, {
    knownRuntimeIds: new Set(["emulatorjs"]),
    selectedRuntimeIds: demoRuntimes,
  })).toThrow("references unknown runtime js-dos");

  expect(() => validateDemoGameManifest(DEMO_GAME_MANIFEST, {
    knownRuntimeIds: knownRuntimes,
    selectedRuntimeIds: new Set(["emulatorjs"]),
  })).toThrow("requires unselected runtime js-dos");

  expect(() => validateDemoGameManifest(DEMO_GAME_MANIFEST, {
    knownRuntimeIds: knownRuntimes,
    selectedRuntimeIds: new Set(["js-dos"]),
  })).toThrow("requires unselected runtime emulatorjs");
});

test("Demo manifest rejects duplicate destinations and incomplete legal authority", () => {
  const entry = DEMO_GAME_MANIFEST.entries[0]!;
  const duplicate: DemoGameManifest = {
    format: DEMO_GAME_MANIFEST.format,
    entries: [entry, { ...entry, id: "duplicate" }],
  };
  expect(() => validateDemoGameManifest(duplicate, {
    knownRuntimeIds: knownRuntimes,
    selectedRuntimeIds: demoRuntimes,
  })).toThrow(`repeats destination ${entry.filesystemPath}`);

  const missingLicense: DemoGameManifest = {
    format: DEMO_GAME_MANIFEST.format,
    entries: [{
      ...entry,
      redistribution: { ...entry.redistribution, license: "" },
    }],
  };
  expect(() => validateDemoGameManifest(missingLicense, {
    knownRuntimeIds: knownRuntimes,
    selectedRuntimeIds: demoRuntimes,
  })).toThrow("missing plasmon-demo-jsdos license");
});

test("EmulatorJS proof ROM remains test-only and absent from user-facing Demo manifest", () => {
  expect(DEMO_GAME_MANIFEST.entries.some(({ filesystemPath }) => filesystemPath.endsWith("PlasmonTest.nes"))).toBe(false);
  expect(DEMO_GAME_MANIFEST.entries.some(({ filesystemPath }) => filesystemPath === DEMO_NES_PATH)).toBe(true);
});
