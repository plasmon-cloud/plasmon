export interface BuildMetafileLike {
  outputs: Record<string, { inputs?: Record<string, unknown> }>;
}

const REQUIRED_MAIN_INPUT_SUFFIXES = [
  "/src/native-apps/content-apps.ts",
  "/src/native-apps/text/TextEditor.tsx",
  "/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
  "/src/native-apps/markdown/MarkdownEditor.tsx",
  "/src/native-apps/markdown/MarkdownPreview.tsx",
] as const;

/**
 * Package/build evidence for the user-launchable first-party native application
 * set registered by production composition. This is deliberately not a runtime
 * application catalog: application identity/registration remains owned by the
 * production NativeApplicationRegistry composition. These paths only state the
 * component inputs whose disappearance from the esbuild graph would make a
 * packaged native application impossible to load.
 *
 * Runtime-only process hosts such as js-dos are intentionally excluded. Their
 * packaged runtime scripts/assets are validated by their dedicated build/runtime
 * contract rather than being treated as ordinary launchable native apps.
 */
export const FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS = [
  { name: "Text", suffix: "/src/native-apps/text/TextEditor.tsx" },
  { name: "Markdown", suffix: "/src/native-apps/markdown/MarkdownEditor.tsx" },
  { name: "Photos", suffix: "/src/native-apps/photos/Photos.tsx" },
  { name: "Video", suffix: "/src/native-apps/video/VideoPlayer.tsx" },
  { name: "Browser", suffix: "/src/native-apps/browser/Browser.tsx" },
  { name: "Settings", suffix: "/src/native-apps/settings/Settings.tsx" },
  { name: "Explorer", suffix: "/src/native-apps/explorer/ExplorerApp.tsx" },
  { name: "Properties", suffix: "/src/native-apps/properties/PropertiesApp.tsx" },
  { name: "Recycle Bin", suffix: "/src/native-apps/recycle-bin/RecycleBin.tsx" },
] as const;

const REQUIRED_ENGINE_INPUT_FRAGMENTS = [
  "/node_modules/monaco-editor/",
  "/node_modules/marked/",
  "/node_modules/dompurify/",
] as const;

const MONACO_PROGRAM_FILES_OUTPUT_ROOT = "/dist/web/System/Program Files/MonacoEditor/";
const REQUIRED_FRONTEND_OUTPUT_SUFFIXES = [
  "/dist/web/main.js",
  "/dist/web/main.bundle.css",
] as const;
const REQUIRED_MONACO_OUTPUT_SUFFIXES = [
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}editor.worker.js`,
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}json.worker.js`,
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}css.worker.js`,
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}html.worker.js`,
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}ts.worker.js`,
] as const;
const REQUIRED_SLIM_MONACO_OUTPUT_SUFFIXES = [
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}editor.worker.js`,
] as const;

type MonacoProfile = "slim" | "base";

function normalized(value: string): string {
  return `/${value.replaceAll("\\", "/").replace(/^\.?\//u, "")}`;
}

function hasSuffix(values: readonly string[], suffix: string): boolean {
  return values.some((value) => normalized(value).endsWith(suffix));
}

export interface NativeAppPackageProfile {
  requireEditors?: boolean;
  monacoProfile?: MonacoProfile;
}

export function assertMatureNativeAppBundle(
  metafile: BuildMetafileLike,
  profile: NativeAppPackageProfile = {},
): void {
  const requireEditors = profile.requireEditors ?? true;
  const monacoProfile = profile.monacoProfile ?? "base";
  const outputs = Object.entries(metafile.outputs);
  const outputPaths = outputs.map(([path]) => path);
  const main = outputs.find(([path]) => normalized(path).endsWith("/dist/web/main.js"));
  if (!main) throw new Error("Native app package build did not emit dist/web/main.js");

  const mainInputs = Object.keys(main[1].inputs ?? {});
  const requiredMainInputs = requireEditors
    ? REQUIRED_MAIN_INPUT_SUFFIXES
    : [REQUIRED_MAIN_INPUT_SUFFIXES[0]];
  for (const suffix of requiredMainInputs) {
    if (!hasSuffix(mainInputs, suffix)) {
      throw new Error(`Native app package main bundle is missing ${suffix}`);
    }
  }

  // Use the complete build graph rather than output/chunk names. Eager loaders
  // currently land in main.js while dynamic imports may move to split chunks in
  // a future build without changing the package-level inclusion contract.
  const allInputs = outputs.flatMap(([, output]) => Object.keys(output.inputs ?? {}));
  const requiredApps = requireEditors
    ? FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS
    : FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.filter(({ name }) => name !== "Text" && name !== "Markdown");
  for (const app of requiredApps) {
    if (!hasSuffix(allInputs, app.suffix)) {
      throw new Error(`Native app package build is missing first-party ${app.name} loader input ${app.suffix}`);
    }
  }

  const css = outputs.find(([path]) => normalized(path).endsWith("/dist/web/main.bundle.css"));
  if (!css) throw new Error("Native app package build did not emit dist/web/main.bundle.css");
  const cssInputs = Object.keys(css[1].inputs ?? {});
  if (requireEditors && !cssInputs.some((path) => normalized(path).includes("/node_modules/monaco-editor/"))) {
    throw new Error("Native app package stylesheet is missing Monaco editor CSS");
  }

  const requiredEngineInputs = requireEditors ? REQUIRED_ENGINE_INPUT_FRAGMENTS : [];
  for (const fragment of requiredEngineInputs) {
    if (!allInputs.some((path) => normalized(path).includes(fragment))) {
      throw new Error(`Native app package build is missing mature engine input ${fragment}`);
    }
  }

  const requiredOutputs = !requireEditors
    ? REQUIRED_FRONTEND_OUTPUT_SUFFIXES
    : monacoProfile === "slim"
      ? [...REQUIRED_FRONTEND_OUTPUT_SUFFIXES, ...REQUIRED_SLIM_MONACO_OUTPUT_SUFFIXES]
      : [...REQUIRED_FRONTEND_OUTPUT_SUFFIXES, ...REQUIRED_MONACO_OUTPUT_SUFFIXES];
  for (const suffix of requiredOutputs) {
    if (!hasSuffix(outputPaths, suffix)) {
      throw new Error(`Native app package build is missing required output ${suffix}`);
    }
  }

  if (outputPaths.some((path) => normalized(path).includes("/dist/web/monaco-workers/"))) {
    throw new Error("Native app package build still emits the legacy top-level Monaco worker path");
  }
}

function replaceEntryAsset(
  html: string,
  asset: "main.js" | "main.css" | "runtime/monaco/worker-sources.js",
  fingerprint: string,
): string {
  const pattern = new RegExp(`(\\./${asset.replace(".", "\\.")})(?:\\?v=[A-Za-z0-9_-]+)?`, "gu");
  const replaced = html.replace(pattern, `$1?v=${fingerprint}`);
  if (replaced === html) throw new Error(`Packaged index.html does not reference ./${asset}`);
  return replaced;
}

/**
 * Keep stable package filenames while making each built frontend point at the
 * exact JS/CSS/worker bytes that were produced with it. This prevents a hosted
 * browser cache from mixing an older application engine with a newly installed
 * package.
 */
export function cacheBustEntryAssets(html: string, fingerprint: string): string {
  if (!/^[a-f0-9]{12,64}$/u.test(fingerprint)) throw new Error("Invalid frontend build fingerprint");
  return replaceEntryAsset(
    replaceEntryAsset(
      replaceEntryAsset(html, "main.js", fingerprint),
      "main.css",
      fingerprint,
    ),
    "runtime/monaco/worker-sources.js",
    fingerprint,
  );
}
