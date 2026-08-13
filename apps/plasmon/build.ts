import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import type { BuildOptions } from "esbuild";
import {
  PACKAGED_DEMO_GAME_FILENAME,
  createPlasmonDemoGameBundle,
} from "./src/games/demoFixtureBundle.ts";
import { assertMatureNativeAppBundle, cacheBustEntryAssets } from "./src/native-apps/packaging.ts";

const mainOutfile = "./dist/web/main.js";
const bundledCss = "./dist/web/main.bundle.css";
const outputCss = "./dist/web/main.css";
const outputIndex = "./dist/web/index.html";
const args = process.argv.slice(2);
const devMode = args[0] === "dev";

const JS_DOS_VERSION = "8.4.1";
const JS_DOS_RELEASE_URL = `https://github.com/caiiiycuk/js-dos/releases/download/v${JS_DOS_VERSION}/release.zip`;
const JS_DOS_RELEASE_SHA256 = "26118692bbb180aec78ec1697eb1ea6b28ff410101870cfa3e68309914c7eaa6";
const PACKAGED_JS_DOS_ROOT = "./System/Program Files/js-dos/";
const JS_DOS_BROWSER_RUNTIME_ROOT = "./runtime/jsdos/";
const JS_DOS_BROWSER_RUNTIME_DIRECTORY = "./dist/web/runtime/jsdos";
let proofAssetsPromise: Promise<void> | null = null;

const EMULATORJS_VERSION = "4.2.3";
const EMULATORJS_DATA_URL = `https://cdn.emulatorjs.org/${EMULATORJS_VERSION}/data`;
const EMULATORJS_ASSETS = [
  "loader.js",
  "emulator.min.js",
  "emulator.min.css",
  "cores/fceumm-wasm.data",
  "cores/fceumm-legacy-wasm.data",
  "compression/extract7z.js",
] as const;
const EMULATORJS_BROWSER_DATA_DIRECTORY = "./dist/web/runtime/emulatorjs/data";
let emulatorJsAssetsPromise: Promise<void> | null = null;

async function stripRemoteDiagnostics(): Promise<void> {
  const source = await readFile(mainOutfile, "utf8");
  const sanitized = source.replaceAll("https://react.dev/errors/", "#react-error-");
  if (sanitized !== source) await writeFile(mainOutfile, sanitized);
}

/**
 * Plasmon's application styles are imported by src/index.tsx. Monaco's ESM
 * modules contribute additional CSS to the same esbuild output. esbuild emits
 * that complete stylesheet as main.bundle.css; publish it as main.css because
 * public/index.html references that stable package path.
 */
async function mergeApplicationStyles(): Promise<void> {
  const generated = await readFile(bundledCss, "utf8");
  await writeFile(outputCss, generated);
}

async function fingerprintEntryAssets(): Promise<void> {
  const [javascript, css, index] = await Promise.all([
    readFile(mainOutfile),
    readFile(outputCss),
    readFile(outputIndex, "utf8"),
  ]);
  const fingerprint = createHash("sha256")
    .update(javascript)
    .update(css)
    .digest("hex")
    .slice(0, 16);
  await writeFile(outputIndex, cacheBustEntryAssets(index, fingerprint));
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to fetch build asset (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function findZipEnd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("js-dos release ZIP has no end-of-central-directory record");
}

async function extractReleaseZip(bytes: Uint8Array, destination: string): Promise<void> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findZipEnd(bytes);
  const entries = view.getUint16(end + 10, true);
  let centralOffset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("js-dos release ZIP central directory is malformed");
    }
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const uncompressedSize = view.getUint32(centralOffset + 24, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
    centralOffset += 46 + nameLength + extraLength + commentLength;

    if (!name.startsWith("dist/") || name.endsWith("/")) continue;
    const relative = name.slice("dist/".length);
    const parts = relative.split("/");
    if (!relative || parts.some((part) => !part || part === "." || part === "..")) {
      throw new Error(`Unsafe js-dos release path: ${name}`);
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Malformed js-dos ZIP entry: ${name}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const output = method === 0
      ? compressed
      : method === 8
        ? new Uint8Array(inflateRawSync(compressed))
        : (() => { throw new Error(`Unsupported ZIP compression method ${method} for ${name}`); })();
    if (output.length !== uncompressedSize) {
      throw new Error(`Unexpected uncompressed size for js-dos release entry: ${name}`);
    }

    const target = join(destination, ...parts);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output);
  }
}

async function rebaseJsDosRelease(runtimeDirectory: string, packageRoot: string): Promise<void> {
  for (const name of ["js-dos.js", "js-dos.css"]) {
    const path = join(runtimeDirectory, name);
    const source = await readFile(path, "utf8");
    const rebased = source.replaceAll("/latest/", packageRoot);
    if (rebased !== source) await writeFile(path, rebased);
  }
}

async function installPlayableProofAssets(): Promise<void> {
  if (proofAssetsPromise) return proofAssetsPromise;
  proofAssetsPromise = (async () => {
    const releaseZip = await fetchBytes(JS_DOS_RELEASE_URL);

    if (sha256(releaseZip) !== JS_DOS_RELEASE_SHA256) {
      throw new Error("Pinned js-dos release digest mismatch");
    }

    const runtimeDirectory = "./dist/web/System/Program Files/js-dos";
    const browserRuntimeDirectory = JS_DOS_BROWSER_RUNTIME_DIRECTORY;
    await Promise.all([
      rm(runtimeDirectory, { recursive: true, force: true }),
      rm(browserRuntimeDirectory, { recursive: true, force: true }),
    ]);
    await Promise.all([
      mkdir(runtimeDirectory, { recursive: true }),
      mkdir(browserRuntimeDirectory, { recursive: true }),
    ]);
    await Promise.all([
      extractReleaseZip(releaseZip, runtimeDirectory),
      extractReleaseZip(releaseZip, browserRuntimeDirectory),
    ]);
    await Promise.all([
      rebaseJsDosRelease(runtimeDirectory, PACKAGED_JS_DOS_ROOT),
      rebaseJsDosRelease(browserRuntimeDirectory, JS_DOS_BROWSER_RUNTIME_ROOT),
    ]);
    for (const directory of [runtimeDirectory, browserRuntimeDirectory]) {
      await Promise.all([
        access(join(directory, "js-dos.js")),
        access(join(directory, "js-dos.css")),
        access(join(directory, "emulators", "emulators.js")),
        access(join(directory, "emulators", "wdosbox.js")),
        access(join(directory, "emulators", "wdosbox.wasm")),
      ]);
    }
    await writeFile(
      join(runtimeDirectory, "runtime.json"),
      `${JSON.stringify({
        runtime: "js-dos",
        version: JS_DOS_VERSION,
        releaseSha256: JS_DOS_RELEASE_SHA256,
        browserRuntimeRoot: "runtime/jsdos/",
      }, null, 2)}\n`,
    );

    const fixturePath = join("./dist/web/fixtures", PACKAGED_DEMO_GAME_FILENAME);
    await mkdir(dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, createPlasmonDemoGameBundle());
  })();
  return proofAssetsPromise;
}

function createPlasmonNesTestRom(): Uint8Array {
  const headerBytes = 16;
  const prgBytes = 16_384;
  const chrBytes = 8_192;
  const rom = new Uint8Array(headerBytes + prgBytes + chrBytes);

  // iNES 1.0, mapper 0 / NROM-128, one PRG bank, one CHR bank, no battery SRAM.
  rom.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00], 0);

  // Minimal original 6502 program: initialize the stack, then remain in a
  // stable loop. It is acceptance data, not a bundled third-party game.
  rom.set([0x78, 0xd8, 0xa2, 0xff, 0x9a, 0x4c, 0x05, 0x80], headerBytes);
  const vectors = headerBytes + prgBytes - 6;
  rom.set([
    0x00, 0x80, // NMI -> $8000
    0x00, 0x80, // RESET -> $8000
    0x00, 0x80, // IRQ -> $8000
  ], vectors);
  return rom;
}

async function installEmulatorJsProofAssets(): Promise<void> {
  if (emulatorJsAssetsPromise) return emulatorJsAssetsPromise;
  emulatorJsAssetsPromise = (async () => {
    const downloaded = await Promise.all(
      EMULATORJS_ASSETS.map(async (relative) => ({
        relative,
        bytes: await fetchBytes(`${EMULATORJS_DATA_URL}/${relative}`),
      })),
    );

    const runtimeDirectory = "./dist/web/System/Program Files/EmulatorJS";
    const dataDirectory = join(runtimeDirectory, "data");
    const browserDataDirectory = EMULATORJS_BROWSER_DATA_DIRECTORY;
    await Promise.all([
      rm(runtimeDirectory, { recursive: true, force: true }),
      rm("./dist/web/runtime/emulatorjs", { recursive: true, force: true }),
    ]);
    await Promise.all([
      mkdir(dataDirectory, { recursive: true }),
      mkdir(browserDataDirectory, { recursive: true }),
    ]);

    for (const asset of downloaded) {
      if (asset.bytes.length === 0) throw new Error(`Empty EmulatorJS asset: ${asset.relative}`);
      const parts = asset.relative.split("/");
      const canonicalTarget = join(dataDirectory, ...parts);
      const browserTarget = join(browserDataDirectory, ...parts);
      await Promise.all([
        mkdir(dirname(canonicalTarget), { recursive: true }),
        mkdir(dirname(browserTarget), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(canonicalTarget, asset.bytes),
        writeFile(browserTarget, asset.bytes),
      ]);
    }

    const loader = new TextDecoder().decode(
      downloaded.find(({ relative }) => relative === "loader.js")?.bytes ?? new Uint8Array(),
    );
    if (!loader.includes("EJS_emulator") || !loader.includes("EJS_onGameStart")) {
      throw new Error("Pinned EmulatorJS loader does not expose the expected 4.2.3 lifecycle hooks");
    }

    // EmulatorJS treats a missing core report as optional. Publish the same
    // package-local report into both the managed Program Files authority and
    // the URL-safe browser transport path used by Kernel app-host routing.
    for (const root of [dataDirectory, browserDataDirectory]) {
      const reportPath = join(root, "cores", "reports", "fceumm.json");
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, "{}\n");
    }
    await writeFile(
      join(runtimeDirectory, "runtime.json"),
      `${JSON.stringify({
        runtime: "EmulatorJS",
        version: EMULATORJS_VERSION,
        source: `https://github.com/EmulatorJS/EmulatorJS/releases/tag/v${EMULATORJS_VERSION}`,
        core: "fceumm",
        resourceType: ".nes",
        browserDataRoot: "runtime/emulatorjs/data/",
      }, null, 2)}\n`,
    );

    const fixturePath = "./dist/web/Games/Test ROMs/PlasmonTest.nes";
    await mkdir(dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, createPlasmonNesTestRom());
  })();
  return emulatorJsAssetsPromise;
}

const config: BuildOptions = {
  entryPoints: [
    { in: "./src/index.tsx", out: "main" },
    { in: "./src/os/fs/background.ts", out: "service" },
    { in: "monaco-editor/esm/vs/editor/editor.worker.js", out: "monaco-workers/editor.worker" },
    { in: "monaco-editor/esm/vs/language/json/json.worker.js", out: "monaco-workers/json.worker" },
    { in: "monaco-editor/esm/vs/language/css/css.worker.js", out: "monaco-workers/css.worker" },
    { in: "monaco-editor/esm/vs/language/html/html.worker.js", out: "monaco-workers/html.worker" },
    { in: "monaco-editor/esm/vs/language/typescript/ts.worker.js", out: "monaco-workers/ts.worker" },
  ],
  outdir: "./dist/web",
  bundle: true,
  minify: !devMode,
  sourcemap: devMode ? "inline" : false,
  external: [],
  format: "esm",
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx", ".ttf": "file" },
  outExtension: { ".css": ".bundle.css" },
  platform: "browser",
  metafile: true,
  plugins: [
    sassPlugin(),
    copyStaticFiles({
      src: "./public",
      dest: "./dist/web",
      dereference: true,
      errorOnExist: false,
      preserveTimestamps: true,
      recursive: true,
    }),
    {
      name: "neutron-self-contained-assets",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length !== 0) return;
          if (!result.metafile) throw new Error("Plasmon build requires an esbuild metafile");
          await Promise.all([installPlayableProofAssets(), installEmulatorJsProofAssets()]);
          assertMatureNativeAppBundle(result.metafile);
          await mergeApplicationStyles();
          if (!devMode) await stripRemoteDiagnostics();
          await fingerprintEntryAssets();
        });
      },
    },
  ],
};

await rm("./dist/web", { recursive: true, force: true });

if (args[0] === "watch") {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log("Watching local files for changes...");
} else if (devMode) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  await ctx.rebuild();

  const root = new URL("./dist/web/", import.meta.url);
  const port = Number(process.env.PORT ?? 5173);
  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      const relative = url.pathname === "/"
        ? "index.html"
        : decodeURIComponent(url.pathname.slice(1));
      if (!relative || relative.split("/").includes("..")) {
        return new Response("Not found", { status: 404 });
      }
      const file = Bun.file(fileURLToPath(new URL(relative, root)));
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file);
    },
  });

  console.log(`Plasmon UI dev server: http://localhost:${port}`);
  console.log("Standalone mode uses mock Neutron data; no Kernel build is required.");
} else {
  try {
    await esbuild.build(config);
  } catch (error: unknown) {
    console.error("Plasmon UI build failed:", error);
    process.exitCode = 1;
  }
}
