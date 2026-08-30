import type { DiagnosticLogger } from "../../os/diagnostics/index.ts";

let emulatorJsDiagnosticLogger: DiagnosticLogger | null = null;

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

export function setEmulatorJsDiagnosticLogger(logger: DiagnosticLogger | null): void {
  emulatorJsDiagnosticLogger = logger;
}

export function reportEmulatorJsValidationFailure(error: unknown): void {
  emulatorJsDiagnosticLogger?.error("runtime.emulatorjs.validation.failed", {
    message: "EmulatorJS ROM validation failed",
    runtime: "EmulatorJS",
    core: "nes",
    stage: "rom-validation",
    errorType: errorType(error),
  });
}

export function reportEmulatorJsStartFailure(stage: string, error: unknown): void {
  emulatorJsDiagnosticLogger?.error("runtime.emulatorjs.start.failed", {
    message: "EmulatorJS runtime failed to start",
    runtime: "EmulatorJS",
    core: "nes",
    stage,
    errorType: errorType(error),
  });
}

export function reportEmulatorJsProtocolFailure(stage: string, error: unknown): void {
  emulatorJsDiagnosticLogger?.error("runtime.emulatorjs.protocol.failed", {
    message: "EmulatorJS runtime protocol failed",
    runtime: "EmulatorJS",
    core: "nes",
    stage,
    errorType: errorType(error),
  });
}

export function reportEmulatorJsTimeout(stage: "host-ready" | "runtime-start"): void {
  emulatorJsDiagnosticLogger?.error("runtime.emulatorjs.timeout", {
    message: "EmulatorJS runtime startup timed out",
    runtime: "EmulatorJS",
    core: "nes",
    stage,
  });
}

export function reportEmulatorJsStopFailure(error: unknown): void {
  emulatorJsDiagnosticLogger?.warn("runtime.emulatorjs.stop.failed", {
    message: "EmulatorJS terminate message failed during cleanup",
    runtime: "EmulatorJS",
    core: "nes",
    stage: "cleanup-terminate",
    errorType: errorType(error),
  });
}
