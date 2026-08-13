import { expect, test } from "bun:test";
import { installMonacoEnvironment, monacoWorkerFile } from "../../../src/native-apps/text/monacoEnvironment.ts";

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
  expect(monacoWorkerFile("typescript")).toBe("ts.worker.js");
});
