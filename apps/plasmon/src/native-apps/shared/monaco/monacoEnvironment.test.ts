import { expect, test } from "bun:test";
import {
  monacoWorkerBootstrapSource,
  monacoWorkerFile,
  monacoWorkerPath,
} from "./monacoEnvironment.ts";

test("slim Monaco maps every language-service label to the packaged editor worker", () => {
  for (const label of ["editorWorkerService", "typescript", "javascript", "json", "css", "html"]) {
    expect(monacoWorkerFile(label, true)).toBe("editor.worker.js");
  }

  expect(monacoWorkerPath("typescript", true)).toBe(
    "./System/Program Files/MonacoEditor/editor.worker.js",
  );
  expect(monacoWorkerBootstrapSource(
    "javascript",
    { "editor.worker.js": "packaged editor worker bytes" },
    true,
  )).toBe("packaged editor worker bytes");
});

test("slim Monaco fails closed when its packaged editor worker source is absent", () => {
  expect(() => monacoWorkerBootstrapSource("typescript", {}, true)).toThrow(
    "Missing packaged Monaco worker source: editor.worker.js",
  );
});

test("full Monaco policy retains the historical language-service worker mapping", () => {
  expect(monacoWorkerFile("typescript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("javascript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("json", false)).toBe("json.worker.js");
  expect(monacoWorkerFile("editorWorkerService", false)).toBe("editor.worker.js");
});
