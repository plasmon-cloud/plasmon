import { expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import {
  generateAppMethodSchemaArtifact,
  validateAppMethodArgs,
} from "neutron-scripts/src/method_schema.js";
import { type NeutronManifest } from "neutron-tools/src/schema.js";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";
import { createPlasmonDemoGameBundle } from "../src/games/demoFixtureBundle.ts";

const manifestUrl = new URL("../neutron.json", import.meta.url);
const backendUrl = new URL("../backend/main.mo", import.meta.url);
const htmlUrl = new URL("../dist/web/index.html", import.meta.url);
const cssUrl = new URL("../dist/web/main.css", import.meta.url);
const appDirectoryUrl = new URL("../", import.meta.url);
const demoGameUrl = new URL("../dist/web/fixtures/PlasmonDemo.jsdos", import.meta.url);
const jsDosRuntimeUrl = new URL("../dist/web/System/Program Files/js-dos/runtime.json", import.meta.url);
const jsDosScriptUrl = new URL("../dist/web/System/Program Files/js-dos/js-dos.js", import.meta.url);
const jsDosStyleUrl = new URL("../dist/web/System/Program Files/js-dos/js-dos.css", import.meta.url);
const jsDosWasmUrl = new URL("../dist/web/System/Program Files/js-dos/emulators/wdosbox.wasm", import.meta.url);
const jsDosBrowserScriptUrl = new URL("../dist/web/runtime/jsdos/js-dos.js", import.meta.url);
const jsDosBrowserStyleUrl = new URL("../dist/web/runtime/jsdos/js-dos.css", import.meta.url);
const jsDosBrowserWasmUrl = new URL("../dist/web/runtime/jsdos/emulators/wdosbox.wasm", import.meta.url);
const emulatorHostHtmlUrl = new URL("../dist/web/emulatorjs-host.html", import.meta.url);
const emulatorHostScriptUrl = new URL("../dist/web/emulatorjs-host.js", import.meta.url);
const emulatorRuntimeUrl = new URL("../dist/web/System/Program Files/EmulatorJS/runtime.json", import.meta.url);
const emulatorLoaderUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/loader.js", import.meta.url);
const emulatorScriptUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/emulator.min.js", import.meta.url);
const emulatorStyleUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/emulator.min.css", import.meta.url);
const emulatorCoreUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/cores/fceumm-wasm.data", import.meta.url);
const emulatorLegacyCoreUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/cores/fceumm-legacy-wasm.data", import.meta.url);
const emulatorExtract7zUrl = new URL("../dist/web/System/Program Files/EmulatorJS/data/compression/extract7z.js", import.meta.url);
const emulatorBrowserLoaderUrl = new URL("../dist/web/runtime/emulatorjs/data/loader.js", import.meta.url);
const emulatorBrowserScriptUrl = new URL("../dist/web/runtime/emulatorjs/data/emulator.min.js", import.meta.url);
const emulatorBrowserStyleUrl = new URL("../dist/web/runtime/emulatorjs/data/emulator.min.css", import.meta.url);
const emulatorBrowserCoreUrl = new URL("../dist/web/runtime/emulatorjs/data/cores/fceumm-wasm.data", import.meta.url);
const emulatorBrowserLegacyCoreUrl = new URL("../dist/web/runtime/emulatorjs/data/cores/fceumm-legacy-wasm.data", import.meta.url);
const emulatorBrowserExtract7zUrl = new URL("../dist/web/runtime/emulatorjs/data/compression/extract7z.js", import.meta.url);
const emulatorFixtureUrl = new URL("../dist/web/Games/Test ROMs/PlasmonTest.nes", import.meta.url);

async function readManifest(): Promise<NeutronManifest> {
  return JSON.parse(await readFile(manifestUrl, "utf8")) as NeutronManifest;
}

async function readBackend(): Promise<string> {
  return readFile(backendUrl, "utf8");
}

test("plasmon manifest validates and declares the shipped method", async () => {
  const manifest = await readManifest();
  const result = validate_neutron_conf(manifest);

  expect(result.valid).toBe(true);
  expect(manifest).toMatchObject({
    id: "plasmon",
    name: "Plasmon",
    version: 100,
    src: "main.mo",
    tiles: [
      {
        id: "main",
        title: "Plasmon",
        path: "index.html",
        icon: "static/icon.svg",
      },
    ],
    func: {
      hello_world: {
        type: "update",
        async: false,
      },
    },
  });
  expect(manifest).not.toHaveProperty("init_arg");
  expect(manifest).not.toHaveProperty("update_source");
});

test("plasmon package output uses the frozen v0.1.0 archive name", async () => {
  const archives = (await readdir(appDirectoryUrl))
    .filter((name) => /^plasmon\.v\d+\.\d+\.\d+\.neutron$/.test(name))
    .sort();

  expect(archives).toEqual(["plasmon.v0.1.0.neutron"]);
});

test("plasmon emits a build-time app method schema", async () => {
  const manifest = await readManifest();
  const backend = await readBackend();
  const artifact = generateAppMethodSchemaArtifact(manifest, backend);

  expect(artifact.methods.hello_world).toMatchObject({
    type: "update",
    input: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "array",
      minItems: 1,
      maxItems: 1,
      prefixItems: [{ type: "string" }],
    },
    output: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "string",
    },
  });
  expect(validateAppMethodArgs(artifact, "hello_world", ["Plasmon"]).valid).toBe(true);
  expect(validateAppMethodArgs(artifact, "hello_world", []).valid).toBe(false);
});

test("plasmon bundles the shared design system stylesheet", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const css = await readFile(cssUrl, "utf8");

  expect(html).toContain("./main.css");
  expect(css).toContain(".nt-app");
  expect(css).toContain(".nt-button");
  expect(css).toContain("--nt-bg-panel");
});

test("plasmon packages js-dos authority and URL-safe browser runtime", async () => {
  const [runtime, script, style, wasm, browserScript, browserStyle, browserWasm] = await Promise.all([
    readFile(jsDosRuntimeUrl, "utf8"),
    readFile(jsDosScriptUrl),
    readFile(jsDosStyleUrl),
    readFile(jsDosWasmUrl),
    readFile(jsDosBrowserScriptUrl),
    readFile(jsDosBrowserStyleUrl),
    readFile(jsDosBrowserWasmUrl),
  ]);

  expect(JSON.parse(runtime)).toMatchObject({
    runtime: "js-dos",
    version: "8.4.1",
    browserRuntimeRoot: "runtime/jsdos/",
  });
  expect(script.length).toBeGreaterThan(10_000);
  expect(style.length).toBeGreaterThan(1_000);
  expect(wasm.length).toBeGreaterThan(100_000);
  expect(browserScript.length).toBeGreaterThan(10_000);
  expect(browserStyle.length).toBeGreaterThan(1_000);
  expect(browserWasm).toEqual(wasm);
  expect(browserScript.toString("utf8")).toContain("./runtime/jsdos/");
});

test("plasmon packages EmulatorJS authority, URL-safe browser assets, NES core, and legal proof ROM", async () => {
  const [
    hostHtml,
    hostScript,
    runtime,
    loader,
    script,
    style,
    core,
    legacyCore,
    extract7z,
    browserLoader,
    browserScript,
    browserStyle,
    browserCore,
    browserLegacyCore,
    browserExtract7z,
    fixture,
  ] = await Promise.all([
    readFile(emulatorHostHtmlUrl, "utf8"),
    readFile(emulatorHostScriptUrl, "utf8"),
    readFile(emulatorRuntimeUrl, "utf8"),
    readFile(emulatorLoaderUrl),
    readFile(emulatorScriptUrl),
    readFile(emulatorStyleUrl),
    readFile(emulatorCoreUrl),
    readFile(emulatorLegacyCoreUrl),
    readFile(emulatorExtract7zUrl),
    readFile(emulatorBrowserLoaderUrl),
    readFile(emulatorBrowserScriptUrl),
    readFile(emulatorBrowserStyleUrl),
    readFile(emulatorBrowserCoreUrl),
    readFile(emulatorBrowserLegacyCoreUrl),
    readFile(emulatorBrowserExtract7zUrl),
    readFile(emulatorFixtureUrl),
  ]);

  expect(hostHtml).toContain("./emulatorjs-host.js");
  expect(hostHtml).toContain('id="game"');
  expect(hostScript).toContain('channel: CHANNEL');
  expect(hostScript).toContain('window.EJS_ready = () => post("loaded")');
  expect(hostScript).toContain('window.EJS_onGameStart = () => post("ready")');
  expect(hostScript).toContain("runtime/emulatorjs/data/loader.js");
  expect(hostScript).not.toContain("System/Program Files/EmulatorJS/data/loader.js");
  expect(hostScript).toContain('["localStorage", "indexedDB"]');
  expect(hostScript).toContain("Object.defineProperty(window, name");
  expect(hostScript).toContain('const disableDeniedScreenWakeLock = () => {');
  expect(hostScript).toContain('Reflect.deleteProperty(owner, "wakeLock")');
  expect(hostScript).toContain('if ("wakeLock" in window.navigator)');
  expect(hostScript).toContain("disableDeniedScreenWakeLock();");
  expect(hostScript).not.toContain('allow="screen-wake-lock"');
  expect(hostScript).not.toContain("wakeLock: { request");
  expect(hostScript).toContain("window.EJS_disableLocalStorage = true");
  expect(hostScript).toContain("window.EJS_disableDatabases = true");
  expect(JSON.parse(runtime)).toMatchObject({
    runtime: "EmulatorJS",
    version: "4.2.3",
    core: "fceumm",
    resourceType: ".nes",
    browserDataRoot: "runtime/emulatorjs/data/",
  });
  expect(loader.toString("utf8")).toContain("EJS_emulator");
  expect(loader.toString("utf8")).toContain("EJS_onGameStart");
  expect(script.length).toBeGreaterThan(10_000);
  expect(style.length).toBeGreaterThan(1_000);
  expect(core.length).toBeGreaterThan(100_000);
  expect(legacyCore.length).toBeGreaterThan(100_000);
  expect(extract7z.length).toBeGreaterThan(100_000);
  expect(browserLoader).toEqual(loader);
  expect(browserScript).toEqual(script);
  expect(browserStyle).toEqual(style);
  expect(browserCore).toEqual(core);
  expect(browserLegacyCore).toEqual(legacyCore);
  expect(browserExtract7z).toEqual(extract7z);
  expect(fixture.length).toBe(16 + 16_384 + 8_192);
  expect([...fixture.subarray(0, 8)]).toEqual([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00]);
});

test("plasmon package contains the deterministic redistributable js-dos demo fixture", async () => {
  const packaged = new Uint8Array(await readFile(demoGameUrl));
  const expected = createPlasmonDemoGameBundle();

  expect(packaged.length).toBeGreaterThan(0);
  expect(Array.from(packaged)).toEqual(Array.from(expected));
});
