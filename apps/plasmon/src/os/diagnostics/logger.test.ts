import { describe, expect, test } from "bun:test";
import {
  createDiagnosticLogger,
  type DiagnosticEmitter,
} from "./logger.ts";
import { DiagnosticEvent } from "./vocabulary.ts";
import type { DiagnosticEventInput, DiagnosticRecord } from "./service.ts";

function captureEmitter(inputs: DiagnosticEventInput[]): DiagnosticEmitter {
  return {
    emit(input) {
      inputs.push(input);
      return {
        timestamp: 0,
        level: input.level,
        subsystem: input.subsystem,
        event: input.event,
        message: input.message,
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        ...(input.context ? { context: input.context } : {}),
      } as DiagnosticRecord;
    },
  };
}

describe("createDiagnosticLogger", () => {
  test("scopes subsystem once and turns extra fields into structured context", () => {
    const inputs: DiagnosticEventInput[] = [];
    const log = createDiagnosticLogger(captureEmitter(inputs), "filesystem");

    log.info(DiagnosticEvent.Filesystem.BootstrapReady, { count: 3, originPath: "/A", destination: "/B" });
    log.error(DiagnosticEvent.Filesystem.BootstrapFailed, {
      message: "Could not persist file",
      error: new Error("write failed"),
      path: "/Notes/todo.txt",
    });

    expect(inputs[0]).toEqual({
      level: "info",
      subsystem: "filesystem",
      event: DiagnosticEvent.Filesystem.BootstrapReady,
      message: DiagnosticEvent.Filesystem.BootstrapReady,
      context: { count: 3, originPath: "/A", destination: "/B" },
    });
    expect(inputs[1]?.level).toBe("error");
    expect(inputs[1]?.subsystem).toBe("filesystem");
    expect(inputs[1]?.event).toBe(DiagnosticEvent.Filesystem.BootstrapFailed);
    expect(inputs[1]?.message).toBe("Could not persist file");
    expect(inputs[1]?.context).toEqual({ path: "/Notes/todo.txt" });
    expect(inputs[1]?.error).toBeInstanceOf(Error);
  });

  test("provides all supported severity helpers", () => {
    const inputs: DiagnosticEventInput[] = [];
    const log = createDiagnosticLogger(captureEmitter(inputs), "test");

    log.debug(DiagnosticEvent.Runtime.UncaughtError);
    log.info(DiagnosticEvent.Runtime.UnhandledRejection);
    log.notice(DiagnosticEvent.Filesystem.BootstrapReady);
    log.warn(DiagnosticEvent.Process.WindowLost);
    log.error(DiagnosticEvent.NativeApp.Crashed);
    log.critical(DiagnosticEvent.Neutron.DiscoveryFailed);

    expect(inputs.map((input) => input.level)).toEqual([
      "debug",
      "info",
      "notice",
      "warn",
      "error",
      "critical",
    ]);
  });

  test("supports correlation and safe default context without overriding call fields", () => {
    const inputs: DiagnosticEventInput[] = [];
    const log = createDiagnosticLogger(captureEmitter(inputs), "open", {
      correlationId: "open-42",
      context: { origin: "desktop", attempt: 1 },
    });

    log.warn(DiagnosticEvent.Neutron.OpenInvalid, {
      attempt: 2,
      handlerId: "native:text",
    });
    log.error(DiagnosticEvent.Neutron.OpenFailed, {
      correlationId: "open-child-1",
      context: { phase: "launch" },
      handlerId: "native:text",
    });

    expect(inputs[0]?.correlationId).toBe("open-42");
    expect(inputs[0]?.context).toEqual({
      origin: "desktop",
      attempt: 2,
      handlerId: "native:text",
    });
    expect(inputs[1]?.correlationId).toBe("open-child-1");
    expect(inputs[1]?.context).toEqual({
      origin: "desktop",
      attempt: 1,
      phase: "launch",
      handlerId: "native:text",
    });
  });
});
