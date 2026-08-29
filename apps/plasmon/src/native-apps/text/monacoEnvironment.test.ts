import { expect, test } from "bun:test";
import {
  installMonacoEnvironment,
  MONACO_BROWSER_TRANSPORT_PATH,
  MONACO_PROGRAM_FILES_RUNTIME_ROOT,
  monacoWorkerBootstrapSource,
  monacoWorkerFile,
  monacoWorkerPath,
} from "../shared/monaco/monacoEnvironment.ts";

test("Monaco workers are constructed from the canonical Program Files runtime path", () => {
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

test("opaque-origin Monaco workers use the preloaded source through a classic blob Worker", () => {
  const calls: Array<{ url: string; options?: WorkerOptions }> = [];
  class FakeWorker {
    constructor(url: string | URL, options?: WorkerOptions) { calls.push({ url: String(url), options }); }
  }

  const previousWorker = (globalThis as typeof globalThis & { Worker?: unknown }).Worker;
  const previousCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  (globalThis as typeof globalThis & { Worker: unknown }).Worker = FakeWorker;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: () => "blob:null/plasmon-monaco-worker",
  });

  const target = {
    origin: "null",
    __PLASMON_MONACO_WORKER_SOURCES__: {
      "ts.worker.js": "(() => { self.onmessage = () => {}; })();\n",
    },
  } as unknown as typeof globalThis;

  try {
    installMonacoEnvironment(target);
    const environment = (target as typeof globalThis & {
      MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker };
    }).MonacoEnvironment;
    environment.getWorker("editor", "typescript");
  } finally {
    if (previousWorker === undefined) delete (globalThis as typeof globalThis & { Worker?: unknown }).Worker;
    else (globalThis as typeof globalThis & { Worker: unknown }).Worker = previousWorker;
    if (previousCreateObjectUrl) Object.defineProperty(URL, "createObjectURL", previousCreateObjectUrl);
    else delete (URL as typeof URL & { createObjectURL?: unknown }).createObjectURL;
  }

  expect(calls).toEqual([{
    url: "blob:null/plasmon-monaco-worker",
    options: { name: "plasmon-monaco-typescript" },
  }]);
});

test("Monaco keeps Program Files authority and uses one preloaded opaque-origin transport", () => {
  expect(MONACO_PROGRAM_FILES_RUNTIME_ROOT).toBe("./System/Program Files/MonacoEditor");
  expect(MONACO_BROWSER_TRANSPORT_PATH).toBe("./runtime/monaco/worker-sources.js");
  expect(monacoWorkerPath("typescript")).toBe("./System/Program Files/MonacoEditor/ts.worker.js");
  expect(monacoWorkerPath("json")).toBe("./System/Program Files/MonacoEditor/json.worker.js");
  expect(monacoWorkerBootstrapSource("typescript", {
    "ts.worker.js": "self.onmessage = () => {};\n",
  })).toBe("self.onmessage = () => {};\n");
  expect(() => monacoWorkerBootstrapSource("typescript", {})).toThrow("Missing packaged Monaco worker source: ts.worker.js");
});
