import { describe, expect, test } from "bun:test";
import {
  createDiagnosticLogger,
  DiagnosticCategory,
  DiagnosticEvent,
  DiagnosticOperation,
  DiagnosticRuntime,
  DiagnosticSource,
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticEventInput,
  type DiagnosticRecord,
} from "./index.ts";

function capture(inputs: DiagnosticEventInput[]) {
  return {
    emit(input: DiagnosticEventInput): DiagnosticRecord {
      inputs.push(input);
      return { timestamp: 0, ...input } as unknown as DiagnosticRecord;
    },
  };
}

describe("diagnostic vocabulary", () => {
  test("uses stable serialized subsystem, runtime, operation, and stage identities", () => {
    expect(DiagnosticSubsystem.RuntimeJsDos).toBe("runtime.js-dos");
    expect(DiagnosticSubsystem.RuntimeEmulatorJs).toBe("runtime.emulatorjs");
    expect(DiagnosticRuntime.Monaco).toBe("monaco");
    expect(DiagnosticRuntime.JsDos).toBe("js-dos");
    expect(DiagnosticRuntime.EmulatorJs).toBe("emulatorjs");
    expect(DiagnosticOperation.Start).toBe("start");
    expect(DiagnosticOperation.Discover).toBe("discover");
    expect(DiagnosticStage.RuntimeStart).toBe("runtime-start");
    expect(DiagnosticStage.WindowClose).toBe("window-close");
    expect(DiagnosticSource.ReactRoot).toBe("react.root");
    expect(DiagnosticCategory.UnhandledRejection).toBe("unhandled-rejection");
  });

  test("scoped events serialize to canonical identities", () => {
    const inputs: DiagnosticEventInput[] = [];
    const log = createDiagnosticLogger(capture(inputs), DiagnosticSubsystem.Process);

    log.error(DiagnosticEvent.Process.CloseHandlerFailed, {
      operation: DiagnosticOperation.Close,
      stage: DiagnosticStage.WindowClose,
      errorType: "TypeError",
    });

    expect(inputs[0]).toEqual({
      level: "error",
      subsystem: "process",
      event: "process.close.handler-failed",
      message: "process.close.handler-failed",
      context: {
        operation: "close",
        stage: "window-close",
        errorType: "TypeError",
      },
    });
  });

  test("runtime-specific scopes expose only their event group at compile time", () => {
    const inputs: DiagnosticEventInput[] = [];
    const log = createDiagnosticLogger(capture(inputs), DiagnosticSubsystem.RuntimeJsDos);
    log.error(DiagnosticEvent.RuntimeJsDos.StartFailed);

    // @ts-expect-error Runtime js-dos producers cannot emit Filesystem events.
    log.error(DiagnosticEvent.Filesystem.BootstrapFailed);
    expect(inputs[0]?.event).toBe("runtime.js-dos.start.failed");
  });

  test("shared categorical fields reject unknown vocabulary values", () => {
    const fields = {
      runtime: DiagnosticRuntime.JsDos,
      operation: DiagnosticOperation.Save,
      stage: DiagnosticStage.CloseSave,
    };
    expect(fields).toEqual({ runtime: "js-dos", operation: "save", stage: "close-save" });

    // @ts-expect-error Shared runtime identity must come from DiagnosticRuntime.
    const invalidRuntime: import("./logger.ts").DiagnosticLogFields = { runtime: "EmulatorJS" };
    expect(invalidRuntime).toEqual({ runtime: "EmulatorJS" });
  });
});
