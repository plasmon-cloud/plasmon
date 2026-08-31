import { describe, expect, test } from "bun:test";
import {
  DiagnosticSubsystem,
  PlasmonDiagnosticService,
  type DiagnosticRecord,
} from "../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import { logJsDosHandledFailure } from "./diagnostics.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { log: diagnostics.for(DiagnosticSubsystem.RuntimeJsDos), records };
}

describe("js-dos handled-failure diagnostics", () => {
  test("emits bounded runtime lifecycle identity without private runtime payloads", () => {
    const { log, records } = diagnosticsHarness();
    const privateRuntimeDetail = "PRIVATE_GAME_OR_RUNTIME_PAYLOAD_662";

    logJsDosHandledFailure(log, {
      kind: "start",
      stage: "runtime-load",
      error: new TypeError(privateRuntimeDetail),
    });
    logJsDosHandledFailure(log, { kind: "restore" });
    logJsDosHandledFailure(log, { kind: "save", reason: "timeout" });
    logJsDosHandledFailure(log, { kind: "stop", error: new Error(privateRuntimeDetail) });

    expect(records.map((record) => record.event)).toEqual([
      "runtime.js-dos.start.failed",
      "runtime.js-dos.restore.failed",
      "runtime.js-dos.save.failed",
      "runtime.js-dos.stop.failed",
    ]);
    expect(records[0]).toMatchObject({
      level: "error",
      subsystem: "runtime.js-dos",
      context: {
        runtime: "js-dos",
        version: "8.4.1",
        stage: "runtime-load",
        errorType: "TypeError",
      },
    });
    expect(records[2]).toMatchObject({
      level: "warn",
      context: { stage: "close-save", reason: "timeout" },
    });
    expect(JSON.stringify(records)).not.toContain(privateRuntimeDetail);
  });

  test("ordinary success requires no diagnostic event", () => {
    const { records } = diagnosticsHarness();
    expect(records).toEqual([]);
  });
});
