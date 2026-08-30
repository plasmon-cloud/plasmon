import { expect, test } from "bun:test";
import {
  monacoWorkerBootstrapSource,
  monacoWorkerFile,
  monacoWorkerPath,
} from "./monacoEnvironment.ts";

test("slim Monaco maps language-service labels to the packaged editor worker", () => {
  for (const label of ["editorWorkerService", "typescript", "javascript", "json", "css", "scss", "less", "html", "handlebars", "razor"]) {
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

test("Base Monaco routes each language family to its dedicated packaged worker", () => {
  expect(monacoWorkerFile("editorWorkerService", false)).toBe("editor.worker.js");
  expect(monacoWorkerFile("typescript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("javascript", false)).toBe("ts.worker.js");
  expect(monacoWorkerFile("json", false)).toBe("json.worker.js");
  expect(monacoWorkerFile("css", false)).toBe("css.worker.js");
  expect(monacoWorkerFile("scss", false)).toBe("css.worker.js");
  expect(monacoWorkerFile("less", false)).toBe("css.worker.js");
  expect(monacoWorkerFile("html", false)).toBe("html.worker.js");
  expect(monacoWorkerFile("handlebars", false)).toBe("html.worker.js");
  expect(monacoWorkerFile("razor", false)).toBe("html.worker.js");
});
