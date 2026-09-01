import { expect, test } from "bun:test";
import { readFile, readdir, stat } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  generateAppMethodSchemaArtifact,
  validateAppMethodArgs,
} from "neutron-scripts/src/method_schema.js";
import { packageArchiveFilename } from "neutron-tools/src/package_archive.js";
import { type NeutronManifest } from "neutron-tools/src/schema.js";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";
import {
  assertSlimRuntimePackagePath,
  DEMO_PAYLOAD_MARKERS,
  SLIM_MAX_BYTES,
} from "../slimPackageGate.ts";
import { resolvePackageProfile } from "../packageProfilePolicy.ts";
import { OPTIONAL_RUNTIME_CATALOG } from "../runtimeConfiguration.ts";

const SLIM_HEADROOM_TARGET_BYTES = 1_850_000;
const manifestUrl = new URL("../neutron.json", import.meta.url);
const backendUrl = new URL("../backend/main.mo", import.meta.url);
const htmlUrl = new URL("../dist/web/index.html", import.meta.url);
const cssUrl = new URL("../dist/web/main.css", import.meta.url);
const mainBundleUrl = new URL("../dist/web/main.js", import.meta.url);
const appDirectoryUrl = new URL("../", import.meta.url);
const distRootUrl = new URL("../dist/", import.meta.url);
const distWebUrl = new URL("../dist/web/", import.meta.url);
const packagePolicy = resolvePackageProfile();
const runtimeConfiguration = process.env.PLASMON_RUNTIME_CONFIGURATION ?? "none";
const jsDosRuntimeSelected = runtimeConfiguration === "js-dos";
const monacoWorkers = packagePolicy.monacoProfile === "slim"
  ? ["editor.worker.js"]
  : ["editor.worker.js", "json.worker.js", "css.worker.js", "html.worker.js", "ts.worker.js"];

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

test("plasmon package output matches the source manifest archive identity", async () => {
  const manifest = await readManifest();
  const expectedArchive = packageArchiveFilename(manifest.id, manifest.version);
  const archives = (await readdir(appDirectoryUrl))
    .filter((name) => name.startsWith(`${manifest.id}.v`) && name.endsWith(".neutron"))
    .sort();

  expect(archives).toEqual([expectedArchive]);
  const archiveStats = await stat(new URL(expectedArchive, appDirectoryUrl));
  if (packagePolicy.isSlim) {
    console.log(`Slim package test size: ${archiveStats.size} bytes`);
    expect(SLIM_HEADROOM_TARGET_BYTES).toBeLessThan(SLIM_MAX_BYTES);
    expect(archiveStats.size).toBeLessThan(SLIM_HEADROOM_TARGET_BYTES);
  } else if (jsDosRuntimeSelected) {
    console.log(`Base + js-dos package test size: ${archiveStats.size} bytes`);
  }
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

test("Slim package input rejects repository-only artifacts and permits runtime assets", () => {
  if (!packagePolicy.isSlim) return;

  for (const rejectedPath of [
    "README.md",
    "web/main.js.map",
    "src/app.ts",
    "tests/app.test.js",
    "web/docs/guide.html",
  ]) {
    expect(() => assertSlimRuntimePackagePath(rejectedPath)).toThrow(
      "non-runtime package input is forbidden",
    );
  }

  for (const runtimePath of [
    "web/index.html",
    "web/main.css",
    "web/config.json",
    "web/static/icon.svg",
    "web/static/wallpaper.jpg",
    "web/static/font.ttf",
    "web/runtime/worker.wasm",
  ]) {
    expect(() => assertSlimRuntimePackagePath(runtimePath)).not.toThrow();
  }
});

test("package runtime inventory matches the explicit optional-runtime selection", async () => {
  expect(packagePolicy.demoOverlay).toBe(false);

  const archiveFiles = (await readdir(distRootUrl, { recursive: true })).map((file) => file.replaceAll("\\", "/"));
  const webFiles = (await readdir(distWebUrl, { recursive: true })).map((file) => file.replaceAll("\\", "/"));
  const gamePayloads = archiveFiles.filter((file) => file.startsWith("web/fixtures/")
    || file.startsWith("web/Games/")
    || [".jsdos", ".dosz", ".nes", ".rom"].some((extension) => file.toLowerCase().endsWith(extension)));
  expect(gamePayloads).toEqual([]);

  const emulatorJsPaths = archiveFiles.filter((file) => file.includes("emulatorjs")
    || file.includes("EmulatorJS")
    || file.startsWith("module/emulatorjs/")
    || file.startsWith("module/emulatorjs-shim/")
    || file.startsWith("module/emulatorjs-runtime/")
    || file.startsWith("module/native-apps/games/game-libraries/")
    || file.startsWith("module/native-apps/games/game-runtime/"));
  expect(emulatorJsPaths).toEqual([]);

  const jsDosRoots = ["System/Program Files/js-dos", "runtime/jsdos"] as const;
  if (!jsDosRuntimeSelected) {
    const jsDosPaths = webFiles.filter((file) => jsDosRoots.some((root) => file === root || file.startsWith(`${root}/`)));
    expect(jsDosPaths).toEqual([]);
  } else {
    expect(packagePolicy).toMatchObject({ packageTier: "base", isSlim: false, demoOverlay: false });
    const requiredAssets = OPTIONAL_RUNTIME_CATALOG["js-dos"].requiredAssets;
    const expected = jsDosRoots.flatMap((root) => requiredAssets.map((asset) => `${root}/${asset}`)).sort();
    const runtimePaths = webFiles.filter((file) => jsDosRoots.some((root) => file.startsWith(`${root}/`)));
    const actual: string[] = [];
    for (const file of runtimePaths) {
      if ((await stat(new URL(file, distWebUrl))).isFile()) actual.push(file);
    }
    expect(actual.sort()).toEqual(expected);

    let logicalBytes = 0;
    for (const asset of requiredAssets) {
      const managed = await readFile(new URL(`../dist/web/System/Program Files/js-dos/${asset}`, import.meta.url));
      const runtime = await readFile(new URL(`../dist/web/runtime/jsdos/${asset}`, import.meta.url));
      expect(managed.length, `${asset} must contain runtime bytes`).toBeGreaterThan(0);
      expect(runtime, `${asset} browser mirror must match Program Files authority`).toEqual(managed);
      logicalBytes += managed.length;
    }
    console.log(`js-dos selected runtime logical bytes: ${logicalBytes}; emitted mirrored bytes: ${logicalBytes * 2}`);
  }

  const workerPaths = webFiles.filter((file) => (file.includes("MonacoEditor/") || file.includes("runtime/monaco/")) && file.endsWith(".worker.js")).sort();
  expect(workerPaths).toEqual([
    ...monacoWorkers.map((worker) => `System/Program Files/MonacoEditor/${worker}`),
    ...(packagePolicy.monacoProfile === "slim"
      ? []
      : monacoWorkers.map((worker) => `runtime/monaco/${worker}`)),
  ].sort());

  const transportScript = await readFile(new URL("../dist/web/runtime/monaco/worker-sources.js", import.meta.url), "utf8");
  const transportScope: Record<string, unknown> = {};
  runInNewContext(transportScript, transportScope);
  const sources = transportScope.__PLASMON_MONACO_WORKER_SOURCES__ as Record<string, string>;
  expect(Object.keys(sources).sort()).toEqual([...monacoWorkers].sort());

  for (const worker of monacoWorkers) {
    const canonical = await readFile(new URL(`../dist/web/System/Program Files/MonacoEditor/${worker}`, import.meta.url), "utf8");
    expect(canonical.length).toBeGreaterThan(0);
    expect(sources[worker]).toBe(canonical);

    if (packagePolicy.monacoProfile !== "slim") {
      const runtime = await readFile(new URL(`../dist/web/runtime/monaco/${worker}`, import.meta.url), "utf8");
      expect(runtime).toBe(canonical);
    }
  }

  const mainBundle = await readFile(mainBundleUrl, "utf8");
  for (const marker of DEMO_PAYLOAD_MARKERS) {
    expect(mainBundle).not.toContain(marker);
  }
});

test("ordinary package tests exercise Base while the Slim ceiling stays Slim-only", () => {
  if (packagePolicy.isSlim) {
    expect(packagePolicy.packageTier).toBe("slim");
    expect(packagePolicy.monacoProfile).toBe("slim");
    return;
  }

  expect(packagePolicy).toMatchObject({
    packageTier: "base",
    isSlim: false,
    demoOverlay: false,
    monacoProfile: "base",
  });
});
