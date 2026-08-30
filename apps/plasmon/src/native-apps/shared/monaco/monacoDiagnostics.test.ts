import { describe, expect, test } from "bun:test";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../../os/fs/index.ts";
import { installMonacoEnvironment } from "./monacoEnvironment.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { log: diagnostics.for("runtime.monaco"), records };
}

describe("Monaco worker-boundary diagnostics", () => {
  test("missing packaged worker source emits one bounded handled-failure event", () => {
    const { log, records } = diagnosticsHarness();
    const privateWorkerSource = "PRIVATE_MONACO_WORKER_SOURCE_662";
    const target = {
      origin: "null",
      __PLASMON_MONACO_WORKER_SOURCES__: {
        "unrelated.worker.js": privateWorkerSource,
      },
    } as unknown as typeof globalThis;

    installMonacoEnvironment(target, log);
    const getWorker = (target as unknown as {
      MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker };
    }).MonacoEnvironment.getWorker;

    expect(() => getWorker("", "typescript")).toThrow(
      "Missing packaged Monaco worker source: editor.worker.js",
    );
    expect(records).toEqual([
      expect.objectContaining({
        level: "error",
        subsystem: "runtime.monaco",
        event: "runtime.monaco.worker.failed",
        context: {
          runtime: "Monaco",
          stage: "worker-source",
          workerFile: "editor.worker.js",
          errorType: "Error",
        },
      }),
    ]);
    expect(JSON.stringify(records)).not.toContain(privateWorkerSource);
  });

  test("synchronous Worker construction failure is observed without its private message", () => {
    const { log, records } = diagnosticsHarness();
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
      installMonacoEnvironment(target, log);
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
});
