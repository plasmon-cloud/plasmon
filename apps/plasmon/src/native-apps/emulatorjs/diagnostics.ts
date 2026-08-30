import type { DiagnosticLogger } from "../../os/diagnostics/index.ts";

const RUNTIME_CONTEXT = {
  runtime: "EmulatorJS",
  core: "nes",
} as const;

export type EmulatorJsHandledFailure =
  | { kind: "validation"; error: unknown }
  | { kind: "start"; stage: "runtime-container" | "host-ready" | "runtime-start"; reason?: "timeout" }
  | { kind: "protocol"; stage: "runtime-message"; error: unknown }
  | { kind: "stop"; error: unknown };

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

/** Emit only failures that the EmulatorJS host intentionally handles or suppresses. */
export function logEmulatorJsHandledFailure(
  log: DiagnosticLogger | undefined,
  failure: EmulatorJsHandledFailure,
): void {
  if (!log) return;

  if (failure.kind === "validation") {
    log.error("runtime.emulatorjs.validation.failed", {
      message: "EmulatorJS ROM validation failed",
      ...RUNTIME_CONTEXT,
      stage: "rom-validation",
      errorType: errorType(failure.error),
    });
    return;
  }

  if (failure.kind === "start") {
    log.error("runtime.emulatorjs.start.failed", {
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
    log.error("runtime.emulatorjs.protocol.failed", {
      message: "EmulatorJS runtime reported a protocol failure",
      ...RUNTIME_CONTEXT,
      stage: failure.stage,
      errorType: errorType(failure.error),
    });
    return;
  }

  log.warn("runtime.emulatorjs.stop.failed", {
    message: "EmulatorJS terminate message failed during cleanup",
    ...RUNTIME_CONTEXT,
    stage: "cleanup-terminate",
    errorType: errorType(failure.error),
  });
}
