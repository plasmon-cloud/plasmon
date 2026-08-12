import { expect, test } from "bun:test";
import {
  assertMatureNativeAppBundle,
  cacheBustEntryAssets,
  FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS,
  type BuildMetafileLike,
} from "./packaging.ts";

function goodMetafile(): BuildMetafileLike {
  return {
    outputs: {
      "dist/web/main.js": {
        inputs: {
          "src/index.tsx": {},
          "src/native-apps/content-apps.ts": {},
          "src/native-apps/text/TextEditor.tsx": {},
          "src/native-apps/text/MonacoEditorSurface.tsx": {},
          "src/native-apps/markdown/MarkdownEditor.tsx": {},
          "src/native-apps/markdown/MarkdownPreview.tsx": {},
          "node_modules/monaco-editor/esm/vs/editor/editor.main.js": {},
          "node_modules/marked/lib/marked.esm.js": {},
          "node_modules/dompurify/dist/purify.es.mjs": {},
        },
      },
      // Dynamic app loaders may be emitted under any chunk filename. Structural
      // coverage follows their source inputs across the complete build graph.
      "dist/web/chunks/native-apps-arbitrary-name.js": {
        inputs: {
          "src/native-apps/photos/Photos.tsx": {},
          "src/native-apps/video/VideoPlayer.tsx": {},
          "src/native-apps/browser/Browser.tsx": {},
          "src/native-apps/settings/Settings.tsx": {},
          "src/native-apps/explorer/ExplorerApp.tsx": {},
          "src/native-apps/properties/PropertiesApp.tsx": {},
          "src/native-apps/recycle-bin/RecycleBin.tsx": {},
        },
      },
      "dist/web/main.bundle.css": { inputs: { "node_modules/monaco-editor/esm/vs/editor/editor.all.css": {} } },
      "dist/web/monaco-workers/editor.worker.js": { inputs: {} },
      "dist/web/monaco-workers/json.worker.js": { inputs: {} },
      "dist/web/monaco-workers/css.worker.js": { inputs: {} },
      "dist/web/monaco-workers/html.worker.js": { inputs: {} },
      "dist/web/monaco-workers/ts.worker.js": { inputs: {} },
    },
  };
}

function deleteInput(metafile: BuildMetafileLike, suffix: string): void {
  const key = suffix.slice(1);
  for (const output of Object.values(metafile.outputs)) {
    if (output.inputs && key in output.inputs) delete output.inputs[key];
  }
}

test("package guard requires mature Text/Markdown engines and Monaco workers", () => {
  expect(() => assertMatureNativeAppBundle(goodMetafile())).not.toThrow();
  const broken = goodMetafile();
  delete broken.outputs["dist/web/main.js"]!.inputs!["src/native-apps/text/MonacoEditorSurface.tsx"];
  expect(() => assertMatureNativeAppBundle(broken)).toThrow("MonacoEditorSurface");
});

test("package guard requires every launchable first-party native app somewhere in the build graph", () => {
  for (const app of FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS) {
    const broken = goodMetafile();
    deleteInput(broken, app.suffix);
    expect(() => assertMatureNativeAppBundle(broken)).toThrow(app.suffix);
  }
});

test("package guard does not require runtime-only js-dos as a launchable first-party app", () => {
  const metafile = goodMetafile();
  expect(
    Object.values(metafile.outputs).some((output) =>
      Object.keys(output.inputs ?? {}).some((input) => input.includes("native-apps/jsdos/")),
    ),
  ).toBe(false);
  expect(() => assertMatureNativeAppBundle(metafile)).not.toThrow();
});

test("package guard rejects a stylesheet without Monaco engine CSS", () => {
  const broken = goodMetafile();
  broken.outputs["dist/web/main.bundle.css"]!.inputs = { "src/style.scss": {} };
  expect(() => assertMatureNativeAppBundle(broken)).toThrow("Monaco editor CSS");
});

test("package guard rejects missing Monaco worker output", () => {
  const broken = goodMetafile();
  delete broken.outputs["dist/web/monaco-workers/ts.worker.js"];
  expect(() => assertMatureNativeAppBundle(broken)).toThrow("ts.worker.js");
});

test("entry asset fingerprint replaces stale query values deterministically", () => {
  const html = '<link rel="stylesheet" href="./main.css?v=old"><script type="module" src="./main.js"></script>';
  const fingerprinted = cacheBustEntryAssets(html, "0123456789abcdef");
  expect(fingerprinted).toContain("./main.css?v=0123456789abcdef");
  expect(fingerprinted).toContain("./main.js?v=0123456789abcdef");
  expect(fingerprinted).not.toContain("?v=old");
});
