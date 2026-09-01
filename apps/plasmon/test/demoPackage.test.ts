import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { packageArchiveFilename } from "neutron-tools/src/package_archive.js";
import type { NeutronManifest } from "neutron-tools/src/schema.js";
import { resolvePackageProfile } from "../packageProfilePolicy.ts";
import { OPTIONAL_RUNTIME_CATALOG } from "../runtimeConfiguration.ts";
import {
  DEMO_NES_BYTES,
  DEMO_NES_LICENSE_TEXT,
  DEMO_NES_SHA256,
  PACKAGED_DEMO_NES_FILENAME,
} from "../src/games/demoNesContract.ts";
import { PACKAGED_DEMO_GAME_FILENAME } from "../src/games/demoFixtureContract.ts";

const distWebUrl = new URL("../dist/web/", import.meta.url);
const appDirectoryUrl = new URL("../", import.meta.url);

function sri(bytes: Uint8Array): string {
  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

test("Demo package is Base + overlay + canonical demo-games runtime selection", () => {
  expect(resolvePackageProfile()).toMatchObject({
    packageTier: "base",
    isSlim: false,
    demoOverlay: true,
    monacoProfile: "base",
  });
  expect(process.env.PLASMON_RUNTIME_CONFIGURATION).toBe("demo-games");
});

test("Demo package contains exactly the declared user-facing game fixtures", async () => {
  const files = (await readdir(distWebUrl, { recursive: true }))
    .map((file) => file.replaceAll("\\", "/"));
  const fixtures = files.filter((file) => file.startsWith("fixtures/")).sort();
  expect(fixtures).toEqual([
    `fixtures/${PACKAGED_DEMO_GAME_FILENAME}`,
    "fixtures/PlasmonNesDemo.LICENSE.txt",
    `fixtures/${PACKAGED_DEMO_NES_FILENAME}`,
  ].sort());
  expect(files.some((file) => file.endsWith("PlasmonTest.nes"))).toBe(false);

  const nes = new Uint8Array(await readFile(new URL(`../dist/web/fixtures/${PACKAGED_DEMO_NES_FILENAME}`, import.meta.url)));
  expect(nes.byteLength).toBe(DEMO_NES_BYTES);
  expect(sri(nes)).toBe(DEMO_NES_SHA256);
  expect(Array.from(nes.slice(0, 8))).toEqual([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00]);

  const license = await readFile(new URL("../dist/web/fixtures/PlasmonNesDemo.LICENSE.txt", import.meta.url), "utf8");
  expect(license).toBe(DEMO_NES_LICENSE_TEXT);
  expect(license).toContain("GPL-3.0-only");
});

test("Demo package materializes both selected runtimes through canonical runtime assets", async () => {
  for (const asset of OPTIONAL_RUNTIME_CATALOG["js-dos"].requiredAssets) {
    await expect(stat(new URL(`../dist/web/System/Program Files/js-dos/${asset}`, import.meta.url))).resolves.toBeDefined();
    await expect(stat(new URL(`../dist/web/runtime/jsdos/${asset}`, import.meta.url))).resolves.toBeDefined();
  }
  for (const asset of OPTIONAL_RUNTIME_CATALOG.emulatorjs.requiredAssets) {
    await expect(stat(new URL(`../dist/web/System/Program Files/EmulatorJS/data/${asset}`, import.meta.url))).resolves.toBeDefined();
    await expect(stat(new URL(`../dist/web/runtime/emulatorjs/data/${asset}`, import.meta.url))).resolves.toBeDefined();
  }
});

test("Demo package archive is measurable without changing the Slim ceiling", async () => {
  const manifest = JSON.parse(await readFile(new URL("../neutron.json", import.meta.url), "utf8")) as NeutronManifest;
  const archive = packageArchiveFilename(manifest.id, manifest.version);
  const archiveStats = await stat(new URL(archive, appDirectoryUrl));
  expect(archiveStats.size).toBeGreaterThan(0);
  console.log(`Demo package size: ${archiveStats.size} bytes`);
});
