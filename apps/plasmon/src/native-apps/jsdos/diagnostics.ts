import type { DiagnosticLogger } from "../../os/diagnostics/index.ts";

const JS_DOS_VERSION = "8.4.1";
let jsDosDiagnosticLogger: DiagnosticLogger | null = null;

export type JsDosActivationStage = "target-validation" | "runtime-load" | "asset-path" | "runtime-start";

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function setJsDosDiagnosticLogger(logger: DiagnosticLogger | null): void {
  jsDosDiagnosticLogger = logger;
}

export function reportJsDosStartFailure(stage: string, error: unknown): void {
  jsDosDiagnosticLogger?.error("runtime.jsdos.start.failed", {
    message: "js-dos runtime failed to start",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage,
    errorType: errorType(error),
  });
}

export function reportJsDosLoadFailure(stage: string, error: unknown): void {
  jsDosDiagnosticLogger?.error("runtime.jsdos.load.failed", {
    message: "js-dos runtime failed to load",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage,
    errorType: errorType(error),
  });
}

export function reportJsDosAssetFailure(stage: string, error: unknown): void {
  jsDosDiagnosticLogger?.error("runtime.jsdos.asset.failed", {
    message: "A packaged js-dos runtime asset was unavailable",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage,
    errorType: errorType(error),
  });
}

export function reportJsDosCompatibilityFailure(stage: string, error: unknown): void {
  jsDosDiagnosticLogger?.error("runtime.jsdos.compatibility.failed", {
    message: "The js-dos browser compatibility adapter failed",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage,
    errorType: errorType(error),
  });
}

/** Classify only stable failures produced by Plasmon's own js-dos adapter. */
export function reportJsDosActivationFailure(stage: JsDosActivationStage, error: unknown): void {
  const detail = errorMessage(error);
  if (stage === "runtime-load") {
    if (detail.includes("Unable to load packaged js-dos runtime")) {
      reportJsDosAssetFailure("script-load", error);
    } else if (detail.includes("loaded without exposing Dos()")) {
      reportJsDosLoadFailure("runtime-global", error);
    } else {
      reportJsDosLoadFailure("runtime-load", error);
    }
    return;
  }
  if (stage === "asset-path") {
    reportJsDosAssetFailure("asset-url", error);
    return;
  }
  if (stage === "runtime-start") {
    if (detail.includes("storage bootstrap")) {
      reportJsDosCompatibilityFailure("storage-install", error);
      return;
    }
    if (detail.includes("StorageManager capability")) {
      reportJsDosCompatibilityFailure("storage-restore", error);
      return;
    }
    if (detail.includes("isolate js-dos Keyboard Lock")) {
      reportJsDosCompatibilityFailure("keyboard-install", error);
      return;
    }
    if (detail.includes("restore js-dos Keyboard Lock")) {
      reportJsDosCompatibilityFailure("keyboard-restore", error);
      return;
    }
  }
  reportJsDosStartFailure(stage, error);
}

export function reportJsDosRestoreFailure(): void {
  jsDosDiagnosticLogger?.warn("runtime.jsdos.restore.failed", {
    message: "Saved js-dos progress could not be restored",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage: "progress-restore",
    reason: "saved-progress-unavailable",
  });
}

export function reportJsDosSaveFailure(result: "failed" | "timeout"): void {
  jsDosDiagnosticLogger?.warn(`runtime.jsdos.save.${result}`, {
    message: result === "timeout" ? "js-dos progress save timed out" : "js-dos progress save failed",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage: "close-save",
  });
}

export function reportJsDosStopFailure(error: unknown): void {
  jsDosDiagnosticLogger?.warn("runtime.jsdos.stop.failed", {
    message: "js-dos runtime stop rejected during cleanup",
    runtime: "js-dos",
    version: JS_DOS_VERSION,
    stage: "cleanup-stop",
    errorType: errorType(error),
  });
}
