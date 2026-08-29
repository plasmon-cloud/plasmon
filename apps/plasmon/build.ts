import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { BuildOptions } from "esbuild";
import { assertMatureNativeAppBundle, cacheBustEntryAssets } from "./src/native-apps/packaging.ts";

const mainOutfile = "./dist/web/main.js";
const bundledCss = "./dist/web/main.bundle.css";
const outputCss = "./dist/web/main.css";
const outputIndex = "./dist/web/index.html";
const args = process.argv.slice(2);
const devMode = args[0] === "dev";
// The slim profile is the default: it retains Monaco, Text, and Markdown while
// keeping game/emulator payloads and unused language workers out. The full
// profile is retained for the complete local comparison build.
const packageProfile = process.env.PLASMON_PACKAGE_PROFILE ?? "slim";
const isEditorProfile = packageProfile === "slim" || packageProfile === "full" || packageProfile === "demo";
const isHackathonCoreProfile = !isEditorProfile;
const isSlimMonacoProfile = packageProfile === "slim" || packageProfile === "demo";
const isDemoProfile = packageProfile === "demo";

const [demoTextSource, demoMarkdownSource, demoSvgSource] = isDemoProfile
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

/**
 * Plasmon's application styles are imported by src/index.tsx. Monaco's ESM
 * modules contribute additional CSS to the same esbuild output. esbuild emits
 * that complete stylesheet as main.bundle.css; publish it as main.css because
 * public/index.html references that stable package path.
 */
async function mergeApplicationStyles(): Promise<void> {
  const generated = await readFile(bundledCss, "utf8");
  await writeFile(outputCss, generated);
  await rm(bundledCss, { force: true });
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

const config: BuildOptions = {
  entryPoints: [
    { in: "./src/index.tsx", out: "main" },
    { in: "./src/os/fs/background.ts", out: "service" },
    ...(isHackathonCoreProfile
      ? []
      : isSlimMonacoProfile
        ? monacoEntryPoints.filter(({ out }) => out.endsWith("/editor.worker") || out.endsWith("/ts.worker"))
        : monacoEntryPoints),
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
    ...(isHackathonCoreProfile
      ? ["monaco-editor", "monaco-editor/*", "./text/*", "./markdown/*"]
      : []),
  ],
  format: "esm",
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx", ".ttf": "file" },
  outExtension: { ".css": ".bundle.css" },
  platform: "browser",
  define: {
    __PLASMON_HACKATHON_CORE__: JSON.stringify(isHackathonCoreProfile),
    __PLASMON_GAME_RUNTIME__: JSON.stringify(false),
    __PLASMON_MONACO_SLIM__: JSON.stringify(isSlimMonacoProfile),
    __PLASMON_DEMO__: JSON.stringify(isDemoProfile),
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
            requireEditors: isEditorProfile,
            monacoProfile: isEditorProfile ? (isSlimMonacoProfile ? "slim" : "full") : undefined,
          });
          await mergeApplicationStyles();
          if (isHackathonCoreProfile) {
            const html = await readFile(outputIndex, "utf8");
            await writeFile(outputIndex, html.replace(/\s*<script src="\.\/runtime\/monaco\/worker-sources\.js"><\/script>/u, ""));
          }
          if (!devMode) await stripRemoteDiagnostics();
          await fingerprintEntryAssets();
        });
      },
    },
  ],
};

await rm("./dist/web", { recursive: true, force: true });
if (isHackathonCoreProfile) {
  await Promise.all([
    rm("./public/runtime/monaco", { recursive: true, force: true }),
    rm("./public/System/Program Files/MonacoEditor", { recursive: true, force: true }),
  ]);
}

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
