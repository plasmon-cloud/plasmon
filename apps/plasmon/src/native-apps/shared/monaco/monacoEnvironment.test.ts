import { expect, test } from "bun:test";
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
