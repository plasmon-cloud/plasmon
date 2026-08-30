import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../../os/fs/index.ts";
import {
  installMonacoEnvironment,
  monacoWorkerBootstrapSource,
  setMonacoDiagnosticLogger,
} from "./monacoEnvironment.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  setMonacoDiagnosticLogger(diagnostics.for("runtime.monaco"));
  return records;
}

afterEach(() => setMonacoDiagnosticLogger(null));

describe("Monaco failure diagnostics", () => {
  test("reports missing packaged worker source without serializing worker bytes", () => {
    const records = diagnosticsHarness();
    const privateWorkerSource = "PRIVATE_MONACO_WORKER_SOURCE_662";

    expect(() => monacoWorkerBootstrapSource(
      "typescript",
      { "unrelated.worker.js": privateWorkerSource },
      true,
    )).toThrow("Missing packaged Monaco worker source: editor.worker.js");

    expect(records).toEqual([
      expect.objectContaining({
        level: "error",
        subsystem: "runtime.monaco",
        event: "runtime.monaco.worker.failed",
        context: {
          runtime: "Monaco",
          stage: "worker-source",
          workerFile: "editor.worker.js",
        },
      }),
    ]);
    expect(JSON.stringify(records)).not.toContain(privateWorkerSource);
  });

  test("reports synchronous Worker construction failure without the underlying error payload", () => {
    const records = diagnosticsHarness();
    const originalWorker = globalThis.Worker;
    const privateRuntimeDetail = "PRIVATE_MONACO_WORKER_ERROR_662";
    class FailingWorker {
      constructor() {
        throw new TypeError(privateRuntimeDetail);
      }
    }

    try {
      (globalThis as { Worker: typeof Worker }).Worker = FailingWorker as unknown as typeof Worker;
      const target = { origin: "https://plasmon.invalid" } as unknown as typeof globalThis;
      installMonacoEnvironment(target);
      const getWorker = (target as unknown as {
        MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker };
      }).MonacoEnvironment.getWorker;
      expect(() => getWorker("", "typescript")).toThrow(privateRuntimeDetail);
    } finally {
      (globalThis as { Worker: typeof Worker }).Worker = originalWorker;
    }

    expect(records[0]).toMatchObject({
      level: "error",
      subsystem: "runtime.monaco",
      event: "runtime.monaco.worker.failed",
      context: {
        runtime: "Monaco",
        stage: "worker-create",
        workerFile: "ts.worker.js",
        errorType: "TypeError",
      },
    });
    expect(JSON.stringify(records)).not.toContain(privateRuntimeDetail);
  });

  test("the shared host binds its runtime-import failure catch to the canonical logger without diagnostic props", () => {
    const host = readFileSync(resolve(import.meta.dir, "MonacoEditorHost.tsx"), "utf8");
    expect(host).toContain('getMonacoDiagnosticLogger()?.error("runtime.monaco.start.failed"');
    expect(host).not.toContain("DiagnosticOperationContext");
    expect(host).not.toContain("diagnostics?:");
    expect(host).not.toContain("operation?:");
  });
});
