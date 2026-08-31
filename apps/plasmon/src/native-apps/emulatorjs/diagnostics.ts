import {
  DiagnosticEvent,
  DiagnosticRuntime,
  DiagnosticStage,
  type DiagnosticLogger,
  type DiagnosticSubsystem,
} from "../../os/diagnostics/index.ts";

const RUNTIME_CONTEXT = {
  runtime: DiagnosticRuntime.EmulatorJs,
  core: "nes",
} as const;

export type EmulatorJsHandledFailure =
  | { kind: "validation"; error: unknown }
  | { kind: "start"; stage: typeof DiagnosticStage.RuntimeContainer | typeof DiagnosticStage.HostReady | typeof DiagnosticStage.RuntimeStart; reason?: "timeout" }
  | { kind: "protocol"; stage: typeof DiagnosticStage.RuntimeMessage; error: unknown }
  | { kind: "stop"; error: unknown };

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

/** Emit only failures that the EmulatorJS host intentionally handles or suppresses. */
export function logEmulatorJsHandledFailure(
  log: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeEmulatorJs> | undefined,
  failure: EmulatorJsHandledFailure,
): void {
  if (!log) return;

  if (failure.kind === "validation") {
    log.error(DiagnosticEvent.RuntimeEmulatorJs.ValidationFailed, {
      message: "EmulatorJS ROM validation failed",
      ...RUNTIME_CONTEXT,
      stage: DiagnosticStage.RomValidation,
      errorType: errorType(failure.error),
    });
    return;
  }

  if (failure.kind === "start") {
    log.error(DiagnosticEvent.RuntimeEmulatorJs.StartFailed, {
      message: failure.reason === "timeout"
        ? "EmulatorJS runtime startup timed out"
        : "EmulatorJS runtime failed to start",
      ...RUNTIME_CONTEXT,
      stage: failure.stage,
      ...(failure.reason ? { reason: failure.reason } : {}),
    });
    return;
  }

  if (failure.kind === "protocol") {
    log.error(DiagnosticEvent.RuntimeEmulatorJs.ProtocolFailed, {
      message: "EmulatorJS runtime reported a protocol failure",
      ...RUNTIME_CONTEXT,
      stage: failure.stage,
      errorType: errorType(failure.error),
    });
    return;
  }

  log.warn(DiagnosticEvent.RuntimeEmulatorJs.StopFailed, {
    message: "EmulatorJS terminate message failed during cleanup",
    ...RUNTIME_CONTEXT,
    stage: DiagnosticStage.CleanupTerminate,
    errorType: errorType(failure.error),
  });
}
