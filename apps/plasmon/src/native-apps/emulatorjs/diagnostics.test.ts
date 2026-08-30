import { afterEach, describe, expect, test } from "bun:test";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import {
  reportEmulatorJsProtocolFailure,
  reportEmulatorJsStartFailure,
  reportEmulatorJsStopFailure,
  reportEmulatorJsTimeout,
  reportEmulatorJsValidationFailure,
  setEmulatorJsDiagnosticLogger,
} from "./diagnostics.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  setEmulatorJsDiagnosticLogger(diagnostics.for("runtime.emulatorjs"));
  return records;
}

afterEach(() => setEmulatorJsDiagnosticLogger(null));

describe("EmulatorJS failure diagnostics", () => {
  test("reports validation, startup, protocol, timeout, and cleanup failures without tokens or ROM payloads", () => {
    const records = diagnosticsHarness();
    const privateRuntimeDetail = "PRIVATE_ROM_TOKEN_OR_PAYLOAD_662";

    reportEmulatorJsValidationFailure(new Error(privateRuntimeDetail));
    reportEmulatorJsStartFailure("frame-create", new TypeError(privateRuntimeDetail));
    reportEmulatorJsProtocolFailure("runtime-message", privateRuntimeDetail);
    reportEmulatorJsTimeout("host-ready");
    reportEmulatorJsTimeout("runtime-start");
    reportEmulatorJsStopFailure(new Error(privateRuntimeDetail));

    expect(records.map((record) => record.event)).toEqual([
      "runtime.emulatorjs.validation.failed",
      "runtime.emulatorjs.start.failed",
      "runtime.emulatorjs.protocol.failed",
      "runtime.emulatorjs.timeout",
      "runtime.emulatorjs.timeout",
      "runtime.emulatorjs.stop.failed",
    ]);
    expect(records[0]).toMatchObject({
      level: "error",
      subsystem: "runtime.emulatorjs",
      context: { runtime: "EmulatorJS", core: "nes", stage: "rom-validation", errorType: "Error" },
    });
    expect(records[2]).toMatchObject({
      context: { runtime: "EmulatorJS", core: "nes", stage: "runtime-message", errorType: "string" },
    });
    expect(records[3]).toMatchObject({
      event: "runtime.emulatorjs.timeout",
      context: { runtime: "EmulatorJS", core: "nes", stage: "host-ready" },
    });
    expect(records[5]?.level).toBe("warn");
    expect(JSON.stringify(records)).not.toContain(privateRuntimeDetail);
  });
});
