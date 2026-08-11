import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { BuildOptions } from "esbuild";

const mainOutfile = "./dist/web/main.js";
const bundledCss = "./dist/web/main.bundle.css";
const publicCss = "./public/main.css";
const outputCss = "./dist/web/main.css";
const args = process.argv.slice(2);
const devMode = args[0] === "dev";

async function stripRemoteDiagnostics(): Promise<void> {
  const source = await readFile(mainOutfile, "utf8");
  const sanitized = source.replaceAll("https://react.dev/errors/", "#react-error-");
  if (sanitized !== source) await writeFile(mainOutfile, sanitized);
}

/**
 * Monaco's ESM modules contribute CSS. Plasmon already ships public/main.css,
 * so esbuild emits imported CSS as main.bundle.css and this deterministic
 * post-step combines the two without letting a copy plugin overwrite either.
 */
async function mergeApplicationStyles(): Promise<void> {
  const [base, generated] = await Promise.all([
    readFile(publicCss, "utf8"),
    readFile(bundledCss, "utf8").catch(() => ""),
  ]);
  await writeFile(outputCss, generated ? `${base}\n\n/* Bundled application engine styles */\n${generated}` : base);
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
  entryNames: "[name]",
  bundle: true,
  minify: !devMode,
  sourcemap: devMode ? "inline" : false,
  external: [],
  format: "esm",
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx", ".ttf": "file" },
  outExtension: { ".css": ".bundle.css" },
  platform: "browser",
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
          await mergeApplicationStyles();
          if (!devMode) await stripRemoteDiagnostics();
        });
      },
    },
  ],
};

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
  } catch {
    process.exit(1);
  }
}
