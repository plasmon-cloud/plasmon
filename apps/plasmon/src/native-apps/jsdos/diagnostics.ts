import {
  DiagnosticEvent,
  DiagnosticRuntime,
  DiagnosticStage,
  type DiagnosticLogger,
  type DiagnosticSubsystem,
} from "../../os/diagnostics/index.ts";

const RUNTIME_CONTEXT = {
  runtime: DiagnosticRuntime.JsDos,
  version: "8.4.1",
} as const;

export type JsDosHandledFailure =
  | { kind: "start"; stage: typeof DiagnosticStage.RuntimeLoad | typeof DiagnosticStage.RuntimeStart; error: unknown }
  | { kind: "restore" }
  | { kind: "save"; reason: "failed" | "timeout" }
  | { kind: "stop"; error: unknown };

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

/** Emit only failures that the js-dos host intentionally handles or converts to UI state. */
export function logJsDosHandledFailure(
  log: DiagnosticLogger<typeof DiagnosticSubsystem.RuntimeJsDos> | undefined,
  failure: JsDosHandledFailure,
): void {
  if (!log) return;

  if (failure.kind === "start") {
    log.error(DiagnosticEvent.RuntimeJsDos.StartFailed, {
      message: "js-dos runtime failed to start",
      ...RUNTIME_CONTEXT,
      stage: failure.stage,
      errorType: errorType(failure.error),
    });
    return;
  }

  if (failure.kind === "restore") {
    log.warn(DiagnosticEvent.RuntimeJsDos.RestoreFailed, {
      message: "Saved js-dos progress could not be restored",
      ...RUNTIME_CONTEXT,
      stage: DiagnosticStage.ProgressRestore,
      reason: "saved-progress-unavailable",
    });
    return;
  }

  if (failure.kind === "save") {
    log.warn(DiagnosticEvent.RuntimeJsDos.SaveFailed, {
      message: failure.reason === "timeout"
        ? "js-dos progress save timed out"
        : "js-dos progress save failed",
      ...RUNTIME_CONTEXT,
      stage: DiagnosticStage.CloseSave,
      reason: failure.reason,
    });
    return;
  }

  log.warn(DiagnosticEvent.RuntimeJsDos.StopFailed, {
    message: "js-dos runtime stop rejected during cleanup",
    ...RUNTIME_CONTEXT,
    stage: DiagnosticStage.CleanupStop,
    errorType: errorType(failure.error),
  });
}
