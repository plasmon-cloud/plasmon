import { afterEach, describe, expect, test } from "bun:test";
import { PlasmonDiagnosticService, type DiagnosticRecord } from "../../os/diagnostics/index.ts";
import { MemoryFsRepository, PersistentFsService } from "../../os/fs/index.ts";
import {
  reportJsDosActivationFailure,
  reportJsDosRestoreFailure,
  reportJsDosSaveFailure,
  reportJsDosStopFailure,
  setJsDosDiagnosticLogger,
} from "./diagnostics.ts";

function diagnosticsHarness() {
  const diagnostics = new PlasmonDiagnosticService({
    fs: new PersistentFsService(new MemoryFsRepository()),
    console: null,
    fileMinLevel: "critical",
  });
  const records: DiagnosticRecord[] = [];
  diagnostics.subscribe((record) => records.push(record));
  setJsDosDiagnosticLogger(diagnostics.for("runtime.jsdos"));
  return records;
}

afterEach(() => setJsDosDiagnosticLogger(null));

describe("js-dos failure diagnostics", () => {
  test("classifies load, asset, compatibility, start, restore, save, and stop failures without runtime payloads", () => {
    const records = diagnosticsHarness();
    const privateRuntimeDetail = "PRIVATE_GAME_OR_RUNTIME_PAYLOAD_662";

    reportJsDosActivationFailure("runtime-load", new TypeError(`Unable to load packaged js-dos runtime: ${privateRuntimeDetail}`));
    reportJsDosActivationFailure("runtime-load", new Error(`js-dos runtime loaded without exposing Dos(): ${privateRuntimeDetail}`));
    reportJsDosActivationFailure("asset-path", new TypeError(privateRuntimeDetail));
    reportJsDosActivationFailure("runtime-start", new Error(`Unable to isolate js-dos storage bootstrap: ${privateRuntimeDetail}`));
    reportJsDosActivationFailure("runtime-start", new Error(`Unable to restore js-dos Keyboard Lock capability: ${privateRuntimeDetail}`));
    reportJsDosActivationFailure("runtime-start", new TypeError(privateRuntimeDetail));
    reportJsDosRestoreFailure();
    reportJsDosSaveFailure("failed");
    reportJsDosSaveFailure("timeout");
    reportJsDosStopFailure(new Error(privateRuntimeDetail));

    expect(records.map((record) => record.event)).toEqual([
      "runtime.jsdos.asset.failed",
      "runtime.jsdos.load.failed",
      "runtime.jsdos.asset.failed",
      "runtime.jsdos.compatibility.failed",
      "runtime.jsdos.compatibility.failed",
      "runtime.jsdos.start.failed",
      "runtime.jsdos.restore.failed",
      "runtime.jsdos.save.failed",
      "runtime.jsdos.save.timeout",
      "runtime.jsdos.stop.failed",
    ]);
    expect(records[0]).toMatchObject({
      level: "error",
      subsystem: "runtime.jsdos",
      context: { runtime: "js-dos", version: "8.4.1", stage: "script-load", errorType: "TypeError" },
    });
    expect(records[1]).toMatchObject({ context: { stage: "runtime-global", errorType: "Error" } });
    expect(records[2]).toMatchObject({ context: { stage: "asset-url", errorType: "TypeError" } });
    expect(records[3]).toMatchObject({ context: { stage: "storage-install", errorType: "Error" } });
    expect(records[4]).toMatchObject({ context: { stage: "keyboard-restore", errorType: "Error" } });
    expect(records[6]?.level).toBe("warn");
    expect(records[9]).toMatchObject({
      level: "warn",
      context: { runtime: "js-dos", version: "8.4.1", stage: "cleanup-stop", errorType: "Error" },
    });
    expect(JSON.stringify(records)).not.toContain(privateRuntimeDetail);
  });

  test("emits nothing when no failure reporter is invoked", () => {
    const records = diagnosticsHarness();
    expect(records).toEqual([]);
  });
});
