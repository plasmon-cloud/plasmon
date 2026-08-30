import type { DiagnosticLogger } from "../../os/diagnostics/index.ts";

const RUNTIME_CONTEXT = {
  runtime: "js-dos",
  version: "8.4.1",
} as const;

export type JsDosHandledFailure =
  | { kind: "start"; stage: "runtime-load" | "runtime-start"; error: unknown }
  | { kind: "restore" }
  | { kind: "save"; reason: "failed" | "timeout" }
  | { kind: "stop"; error: unknown };

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

/** Emit only failures that the js-dos host intentionally handles or converts to UI state. */
export function logJsDosHandledFailure(
  log: DiagnosticLogger | undefined,
  failure: JsDosHandledFailure,
): void {
  if (!log) return;

  if (failure.kind === "start") {
    log.error("runtime.jsdos.start.failed", {
      message: "js-dos runtime failed to start",
      ...RUNTIME_CONTEXT,
      stage: failure.stage,
      errorType: errorType(failure.error),
    });
    return;
  }

  if (failure.kind === "restore") {
    log.warn("runtime.jsdos.restore.failed", {
      message: "Saved js-dos progress could not be restored",
      ...RUNTIME_CONTEXT,
      stage: "progress-restore",
      reason: "saved-progress-unavailable",
    });
    return;
  }

  if (failure.kind === "save") {
    log.warn("runtime.jsdos.save.failed", {
      message: failure.reason === "timeout"
        ? "js-dos progress save timed out"
        : "js-dos progress save failed",
      ...RUNTIME_CONTEXT,
      stage: "close-save",
      reason: failure.reason,
    });
    return;
  }

  log.warn("runtime.jsdos.stop.failed", {
    message: "js-dos runtime stop rejected during cleanup",
    ...RUNTIME_CONTEXT,
    stage: "cleanup-stop",
    errorType: errorType(failure.error),
  });
}
