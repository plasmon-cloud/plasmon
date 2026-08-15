import { expect, test } from "bun:test";
import {
  installMonacoEnvironment,
  MONACO_BROWSER_TRANSPORT_ROOT,
  MONACO_PROGRAM_FILES_RUNTIME_ROOT,
  monacoWorkerBootstrapSource,
  monacoWorkerBrowserPath,
  monacoWorkerFile,
  monacoWorkerPath,
} from "./monacoEnvironment.ts";

test("#89 Monaco workers are constructed from the canonical Program Files runtime path", () => {
  const calls: Array<{ url: string; options?: WorkerOptions }> = [];
  class FakeWorker {
    constructor(url: string | URL, options?: WorkerOptions) { calls.push({ url: String(url), options }); }
  }
  const previousWorker = (globalThis as typeof globalThis & { Worker?: unknown }).Worker;
  (globalThis as typeof globalThis & { Worker: unknown }).Worker = FakeWorker;
  try {
    installMonacoEnvironment(globalThis);
    const environment = (globalThis as typeof globalThis & { MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker } }).MonacoEnvironment;
    for (const label of ["editorWorkerService", "typescript", "javascript", "json", "css", "html"]) environment.getWorker("editor", label);
  } finally {
    if (previousWorker === undefined) delete (globalThis as typeof globalThis & { Worker?: unknown }).Worker;
    else (globalThis as typeof globalThis & { Worker: unknown }).Worker = previousWorker;
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment;
  }
  expect(calls).toHaveLength(6);
  expect(calls.map(({ url }) => url)).toEqual([
    expect.stringContaining("/System/Program Files/MonacoEditor/editor.worker.js"),
    expect.stringContaining("/System/Program Files/MonacoEditor/ts.worker.js"),
    expect.stringContaining("/System/Program Files/MonacoEditor/ts.worker.js"),
    expect.stringContaining("/System/Program Files/MonacoEditor/json.worker.js"),
    expect.stringContaining("/System/Program Files/MonacoEditor/css.worker.js"),
    expect.stringContaining("/System/Program Files/MonacoEditor/html.worker.js"),
  ]);
  expect(calls.every(({ options }) => options?.type === "module")).toBe(true);
  expect(calls.map(({ options }) => options?.name)).toEqual([
    "plasmon-monaco-editorWorkerService",
    "plasmon-monaco-typescript",
    "plasmon-monaco-javascript",
    "plasmon-monaco-json",
    "plasmon-monaco-css",
    "plasmon-monaco-html",
  ]);
  expect(monacoWorkerFile("typescript")).toBe("ts.worker.js");
});

test("#89 Monaco keeps Program Files as authority and uses one URL-safe opaque-origin transport", () => {
  expect(MONACO_PROGRAM_FILES_RUNTIME_ROOT).toBe("./System/Program Files/MonacoEditor");
  expect(MONACO_BROWSER_TRANSPORT_ROOT).toBe("./runtime/monaco");
  expect(monacoWorkerPath("typescript")).toBe("./System/Program Files/MonacoEditor/ts.worker.js");
  expect(monacoWorkerPath("json")).toBe("./System/Program Files/MonacoEditor/json.worker.js");
  expect(monacoWorkerBrowserPath("typescript")).toBe("./runtime/monaco/ts.worker.js");
  expect(monacoWorkerBootstrapSource("typescript", "https://example.test/app/plasmon/index.html")).toBe(
    'import "https://example.test/app/plasmon/runtime/monaco/ts.worker.js";\n',
  );
});
