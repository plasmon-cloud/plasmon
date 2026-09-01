import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { BuildOptions } from "esbuild";
import { materializeEmulatorJsRuntime } from "./emulatorJsRuntimeMaterializer.ts";
import { materializeJsDosRuntime } from "./jsDosRuntimeMaterializer.ts";
import { resolvePackageProfile } from "./packageProfilePolicy.ts";
import {
  prepareRuntimeConfiguration,
  resolveRuntimeConfiguration,
} from "./runtimeConfiguration.ts";
import { createPlasmonDemoGameBundle } from "./src/games/demoFixtureBundle.ts";
import { PACKAGED_DEMO_GAME_FILENAME } from "./src/games/demoFixtureContract.ts";
import { createPlasmonNesTestRom, PACKAGED_EMULATORJS_TEST_FILENAME } from "./src/games/emulatorJsFixture.ts";
import { assertMatureNativeAppBundle, cacheBustEntryAssets } from "./src/native-apps/packaging.ts";

const mainOutfile = "./dist/web/main.js";
const bundledCss = "./dist/web/main.bundle.css";
const outputCss = "./dist/web/main.css";
const monacoWorkerTransport = "./dist/web/runtime/monaco/worker-sources.js";
const outputIndex = "./dist/web/index.html";
const args = process.argv.slice(2);
const devMode = args[0] === "dev";
const packagePolicy = resolvePackageProfile();
const isSlimMonacoProfile = packagePolicy.monacoProfile === "slim";
const demoOverlay = packagePolicy.demoOverlay;

function booleanEnvironment(name: string): boolean {
  const value = process.env[name];
  if (value === undefined || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw new Error(`Invalid ${name} "${value}". Expected one of: 0, 1, false, true.`);
}

const demoGameFixtureSelected = booleanEnvironment("PLASMON_DEMO_GAME_FIXTURE");
const emulatorJsTestFixtureSelected = booleanEnvironment("PLASMON_EMULATORJS_TEST_FIXTURE");
if (packagePolicy.isSlim && (demoGameFixtureSelected || emulatorJsTestFixtureSelected)) {
  throw new Error("Game acceptance fixtures cannot be enabled for the Slim package tier.");
}

const runtimeSelectionValue = process.env.PLASMON_RUNTIME_CONFIGURATION ?? "none";
const runtimeSelection = runtimeSelectionValue === "js-dos"
  ? fileURLToPath(new URL("./runtime-configurations/js-dos.json", import.meta.url))
  : runtimeSelectionValue === "emulatorjs"
    ? fileURLToPath(new URL("./runtime-configurations/emulatorjs.json", import.meta.url))
    : runtimeSelectionValue;
const runtimePolicy = await resolveRuntimeConfiguration(runtimeSelection, {
  packageTier: packagePolicy.packageTier,
  demoOverlay,
});
const jsDosRuntimeSelected = runtimePolicy.configuration.runtimes.includes("js-dos");
const emulatorJsRuntimeSelected = runtimePolicy.configuration.runtimes.includes("emulatorjs");
const gameRuntimeSelected = jsDosRuntimeSelected || emulatorJsRuntimeSelected;
const runtimePreparation = runtimePolicy.configuration.runtimes.length > 0
  ? await prepareRuntimeConfiguration(runtimePolicy, {
    cacheRoot: process.env.PLASMON_RUNTIME_CACHE
      ?? fileURLToPath(new URL("./.plasmon/runtime-cache/", import.meta.url)),
    offline: process.env.PLASMON_RUNTIME_OFFLINE === "1" || process.env.PLASMON_RUNTIME_OFFLINE === "true",
  })
  : null;

const [demoTextSource, demoMarkdownSource, demoSvgSource] = demoOverlay
  ? await Promise.all([
    readFile(new URL("./src/demo/assets/Demo Notes.txt", import.meta.url), "utf8"),
    readFile(new URL("./src/demo/assets/Demo Guide.md", import.meta.url), "utf8"),
    readFile(new URL("./src/demo/assets/Demo Artwork.svg", import.meta.url), "utf8"),
  ])
  : [undefined, undefined, undefined];

async function stripRemoteDiagnostics(): Promise<void> {
  const source = await readFile(mainOutfile, "utf8");
  const sanitized = source.replaceAll("https://react.dev/errors/", "#react-error-");
  if (sanitized !== source) await writeFile(mainOutfile, sanitized);
}

async function mergeApplicationStyles(): Promise<void> {
  const generated = await readFile(bundledCss, "utf8");
  await writeFile(outputCss, generated);
  await rm(bundledCss, { force: true });
}

async function materializeAcceptanceFixtures(): Promise<void> {
  const fixturesRoot = "./dist/web/fixtures";
  await rm(fixturesRoot, { recursive: true, force: true });
  if (!demoGameFixtureSelected && !emulatorJsTestFixtureSelected) return;
  await mkdir(fixturesRoot, { recursive: true });
  if (demoGameFixtureSelected) {
    await writeFile(`${fixturesRoot}/${PACKAGED_DEMO_GAME_FILENAME}`, createPlasmonDemoGameBundle());
  }
  if (emulatorJsTestFixtureSelected) {
    await writeFile(`${fixturesRoot}/${PACKAGED_EMULATORJS_TEST_FILENAME}`, createPlasmonNesTestRom());
  }
}

async function materializeEmulatorJsHost(): Promise<void> {
  if (!emulatorJsRuntimeSelected) return;
  const [html, script] = await Promise.all([
    readFile(new URL("./src/native-apps/emulatorjs/emulatorjs-host.html", import.meta.url)),
    readFile(new URL("./src/native-apps/emulatorjs/emulatorjs-host.js", import.meta.url)),
  ]);
  await Promise.all([
    writeFile("./dist/web/emulatorjs-host.html", html),
    writeFile("./dist/web/emulatorjs-host.js", script),
  ]);
}

async function fingerprintEntryAssets(): Promise<void> {
  const [javascript, css, workerTransport, index] = await Promise.all([
    readFile(mainOutfile),
    readFile(outputCss),
    readFile(monacoWorkerTransport),
    readFile(outputIndex, "utf8"),
  ]);
  const fingerprint = createHash("sha256")
    .update(javascript)
    .update(css)
    .update(workerTransport)
    .digest("hex")
    .slice(0, 16);
  await writeFile(outputIndex, cacheBustEntryAssets(index, fingerprint));
}

const monacoEntryPoints = [
  { in: "monaco-editor/esm/vs/editor/editor.worker.js", out: "System/Program Files/MonacoEditor/editor.worker" },
  { in: "monaco-editor/esm/vs/language/json/json.worker.js", out: "System/Program Files/MonacoEditor/json.worker" },
  { in: "monaco-editor/esm/vs/language/css/css.worker.js", out: "System/Program Files/MonacoEditor/css.worker" },
  { in: "monaco-editor/esm/vs/language/html/html.worker.js", out: "System/Program Files/MonacoEditor/html.worker" },
  { in: "monaco-editor/esm/vs/language/typescript/ts.worker.js", out: "System/Program Files/MonacoEditor/ts.worker" },
  { in: "monaco-editor/esm/vs/editor/editor.worker.js", out: "runtime/monaco/editor.worker" },
  { in: "monaco-editor/esm/vs/language/json/json.worker.js", out: "runtime/monaco/json.worker" },
  { in: "monaco-editor/esm/vs/language/css/css.worker.js", out: "runtime/monaco/css.worker" },
  { in: "monaco-editor/esm/vs/language/html/html.worker.js", out: "runtime/monaco/html.worker" },
  { in: "monaco-editor/esm/vs/language/typescript/ts.worker.js", out: "runtime/monaco/ts.worker" },
] as const;

const slimMonacoEntryPoints = monacoEntryPoints.filter(({ out }) =>
  out === "System/Program Files/MonacoEditor/editor.worker"
);

const config: BuildOptions = {
  entryPoints: [
    { in: "./src/index.tsx", out: "main" },
    { in: "./src/os/fs/background.ts", out: "service" },
    ...(isSlimMonacoProfile ? slimMonacoEntryPoints : monacoEntryPoints),
  ],
  outdir: "./dist/web",
  bundle: true,
  minify: !devMode,
  sourcemap: devMode ? "inline" : false,
  // Public assets are copied verbatim into dist/web. Keep root-relative
  // /static URLs external so Sass/esbuild does not try to resolve them as
  // source-module imports before the public tree is copied.
  external: [
    "/static/*",
    "static/*",
    // Slim has no Terminal registration; keep its browser-only dependency out
    // of the small package even though the full-profile loader remains shared.
    ...(packagePolicy.isSlim ? ["./src/scripting/integration.ts"] : []),
  ],
  format: "esm",
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx", ".ttf": "file" },
  outExtension: { ".css": ".bundle.css" },
  platform: "browser",
  define: {
    __PLASMON_SLIM_PROFILE__: JSON.stringify(packagePolicy.isSlim),
    __PLASMON_GAME_RUNTIME__: JSON.stringify(gameRuntimeSelected),
    __PLASMON_RUNTIME_JSDOS__: JSON.stringify(jsDosRuntimeSelected),
    __PLASMON_RUNTIME_EMULATORJS__: JSON.stringify(emulatorJsRuntimeSelected),
    __PLASMON_MONACO_SLIM__: JSON.stringify(isSlimMonacoProfile),
    __PLASMON_DEMO__: JSON.stringify(demoOverlay),
    __PLASMON_DEMO_GAME_FIXTURE__: JSON.stringify(demoGameFixtureSelected),
    __PLASMON_DEMO_TEXT__: demoTextSource === undefined ? "undefined" : JSON.stringify(demoTextSource),
    __PLASMON_DEMO_MARKDOWN__: demoMarkdownSource === undefined ? "undefined" : JSON.stringify(demoMarkdownSource),
    __PLASMON_DEMO_SVG__: demoSvgSource === undefined ? "undefined" : JSON.stringify(demoSvgSource),
  },
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
          assertMatureNativeAppBundle(result.metafile, {
            requireEditors: true,
            monacoProfile: packagePolicy.monacoProfile,
          });
          await mergeApplicationStyles();
          if (runtimePreparation && jsDosRuntimeSelected) {
            await materializeJsDosRuntime(runtimePolicy, runtimePreparation, "./dist/web");
          }
          if (runtimePreparation && emulatorJsRuntimeSelected) {
            await materializeEmulatorJsRuntime(runtimePolicy, runtimePreparation, "./dist/web");
          }
          await materializeEmulatorJsHost();
          await materializeAcceptanceFixtures();
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
