import { expect, test } from "bun:test";
import { access, stat } from "node:fs/promises";

const appDirectoryUrl = new URL("../", import.meta.url);
const archiveUrl = new URL("../plasmon.v0.1.0.neutron", import.meta.url);
const mainUrl = new URL("../dist/web/main.js", import.meta.url);
const cssUrl = new URL("../dist/web/main.css", import.meta.url);
const monacoWorkerUrl = new URL(
  "../dist/web/System/Program Files/MonacoEditor/editor.worker.js",
  import.meta.url,
);
const monacoTransportUrl = new URL("../dist/web/runtime/monaco/worker-sources.js", import.meta.url);

const omittedPaths = [
  "dist/web/System/Program Files/js-dos",
  "dist/web/runtime/jsdos",
  "dist/web/System/Program Files/EmulatorJS",
  "dist/web/runtime/emulatorjs",
  "dist/web/fixtures/PlasmonDemo.jsdos",
  "dist/web/Games/Test ROMs/PlasmonTest.nes",
] as const;

async function exists(url: URL): Promise<boolean> {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

test("lean Plasmon package keeps the desktop and Monaco runtime", async () => {
  for (const url of [mainUrl, cssUrl, monacoWorkerUrl, monacoTransportUrl]) {
    expect(await exists(url), `${url.pathname} must exist in the lean build`).toBe(true);
  }
});

test("lean Plasmon package omits heavyweight optional game runtimes and fixtures", async () => {
  for (const relative of omittedPaths) {
    const url = new URL(`../${relative}`, import.meta.url);
    expect(await exists(url), `${relative} must be absent from the lean build`).toBe(false);
  }
});

test("lean Plasmon archive remains bounded for active-Kernel preview", async () => {
  const archive = await stat(archiveUrl);

  expect(archive.isFile()).toBe(true);
  expect(archive.size).toBeGreaterThan(1_000_000);
  expect(archive.size).toBeLessThan(12 * 1024 * 1024);

  // Keep the package-name assertion local to the lean lane as well: both
  // profiles are ordinary Plasmon packages consumed by the same installer.
  expect(new URL("plasmon.v0.1.0.neutron", appDirectoryUrl).pathname).toBe(archiveUrl.pathname);
});
