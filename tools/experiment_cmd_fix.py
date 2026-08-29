from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected fix marker not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Terminal is launchable/bundled, but the mature first-party package list also
# drives unrelated theme/release audits. Do not claim those audits in this experiment.
replace_once(
    "apps/plasmon/src/native-apps/packaging.ts",
    '  { name: "Recycle Bin", suffix: "/src/native-apps/recycle-bin/RecycleBin.tsx" },\n  { name: "Terminal", suffix: "/src/native-apps/terminal/Terminal.tsx" },\n] as const;',
    '  { name: "Recycle Bin", suffix: "/src/native-apps/recycle-bin/RecycleBin.tsx" },\n] as const;',
)
replace_once(
    "apps/plasmon/src/native-apps/packaging.ts",
    '    : FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.filter(({ name }) => name !== "Text" && name !== "Markdown" && name !== "Terminal");',
    '    : FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.filter(({ name }) => name !== "Text" && name !== "Markdown");',
)

# Slim now intentionally includes the TypeScript worker for .run.
replace_once(
    "apps/plasmon/src/native-apps/packaging.test.ts",
    '  for (const worker of ["json", "css", "html", "ts"]) {',
    '  for (const worker of ["json", "css", "html"]) {',
)
replace_once(
    "apps/plasmon/src/native-apps/packaging.test.ts",
    '''  delete slim.outputs["dist/web/System/Program Files/MonacoEditor/editor.worker.js"];
  expect(() => assertMatureNativeAppBundle(slim, { monacoProfile: "slim" })).toThrow(
    "/dist/web/System/Program Files/MonacoEditor/editor.worker.js",
  );''',
    '''  delete slim.outputs["dist/web/System/Program Files/MonacoEditor/ts.worker.js"];
  expect(() => assertMatureNativeAppBundle(slim, { monacoProfile: "slim" })).toThrow(
    "/dist/web/System/Program Files/MonacoEditor/ts.worker.js",
  );''',
)

# The terminal is a real system application and therefore gets a system icon.
replace_once(
    "apps/plasmon/src/os/visual/visual.test.ts",
    '    "application", "browser", "file-manager", "photos", "pin", "properties", "recycle-bin", "search", "settings", "start",',
    '    "application", "browser", "file-manager", "photos", "pin", "properties", "recycle-bin", "search", "settings", "start", "terminal",',
)

# New slim worker policy: TS/JS use ts.worker; other language labels stay editor-only.
write("apps/plasmon/src/native-apps/shared/monaco/monacoEnvironment.test.ts", '''import { expect, test } from "bun:test";
import {
  monacoWorkerBootstrapSource,
  monacoWorkerFile,
  monacoWorkerPath,
} from "./monacoEnvironment.ts";

test("slim Monaco packages TypeScript services for .run while other labels stay editor-only", () => {
  for (const label of ["typescript", "javascript"]) {
    expect(monacoWorkerFile(label, true)).toBe("ts.worker.js");
  }
  for (const label of ["editorWorkerService", "json", "css", "html"]) {
    expect(monacoWorkerFile(label, true)).toBe("editor.worker.js");
  }

  expect(monacoWorkerPath("typescript", true)).toBe(
    "./System/Program Files/MonacoEditor/ts.worker.js",
  );
  expect(monacoWorkerBootstrapSource(
    "javascript",
    { "ts.worker.js": "packaged TypeScript worker bytes" },
    true,
  )).toBe("packaged TypeScript worker bytes");
});

test("slim Monaco fails closed when its packaged TypeScript worker source is absent", () => {
  expect(() => monacoWorkerBootstrapSource("typescript", {}, true)).toThrow(
    "Missing packaged Monaco worker source: ts.worker.js",
  );
});

test("full Monaco policy retains the historical language-service worker mapping", () => {
  expect(monacoWorkerFile("typescript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("javascript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("json", false)).toBe("json.worker.js");
  expect(monacoWorkerFile("editorWorkerService", false)).toBe("editor.worker.js");
});
''')

# Terminal is an implementation child under the documented native-app root.
replace_once(
    "apps/plasmon/docs/documentation-boundaries.json",
    '''      "nonBoundaryChildren": [
        "shared"
      ]''',
    '''      "nonBoundaryChildren": [
        "shared",
        "terminal"
      ]''',
)

print("experiment integration fixture fixes applied")
