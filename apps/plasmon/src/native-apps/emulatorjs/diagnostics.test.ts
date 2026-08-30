import { describe, expect, test } from "bun:test";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import { logEmulatorJsHandledFailure } from "./diagnostics.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  return { log: diagnostics.for("runtime.emulatorjs"), records };
}

describe("EmulatorJS handled-failure diagnostics", () => {
  test("emits bounded validation, protocol, timeout, and cleanup identity without ROM or token payloads", () => {
    const { log, records } = diagnosticsHarness();
    const privateRuntimeDetail = "PRIVATE_ROM_TOKEN_OR_PAYLOAD_662";

    logEmulatorJsHandledFailure(log, {
      kind: "validation",
      error: new Error(privateRuntimeDetail),
    });
    logEmulatorJsHandledFailure(log, {
      kind: "protocol",
      stage: "runtime-message",
      error: privateRuntimeDetail,
    });
    logEmulatorJsHandledFailure(log, {
      kind: "start",
      stage: "host-ready",
      reason: "timeout",
    });
    logEmulatorJsHandledFailure(log, {
      kind: "stop",
      error: new Error(privateRuntimeDetail),
    });

    expect(records.map((record) => record.event)).toEqual([
      "runtime.emulatorjs.validation.failed",
      "runtime.emulatorjs.protocol.failed",
      "runtime.emulatorjs.start.failed",
      "runtime.emulatorjs.stop.failed",
    ]);
    expect(records[0]).toMatchObject({
      level: "error",
      subsystem: "runtime.emulatorjs",
      context: {
        runtime: "EmulatorJS",
        core: "nes",
        stage: "rom-validation",
        errorType: "Error",
      },
    });
    expect(records[2]).toMatchObject({
      context: { stage: "host-ready", reason: "timeout" },
    });
    expect(JSON.stringify(records)).not.toContain(privateRuntimeDetail);
  });
});
