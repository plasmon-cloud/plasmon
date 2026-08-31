import {
  DiagnosticEvent,
  DiagnosticOperation,
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticLogger,
} from "../os/diagnostics/index.ts";

let logger: DiagnosticLogger<typeof DiagnosticSubsystem.NativeApp> | null = null;

/** Attach the canonical NativeApp logger once at Plasmon composition. */
export function setNativeAppSemanticDiagnosticLogger(
  next: DiagnosticLogger<typeof DiagnosticSubsystem.NativeApp> | null,
): void {
  logger = next;
}

export function reportDocumentSaveAsRollbackFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.DocumentSaveAsRollbackFailed, {
    message: "Document Save As rollback failed",
    operation: DiagnosticOperation.Delete,
  });
}

export function reportDocumentCloseSaveUnexpectedFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.DocumentCloseSaveUnexpectedFailure, {
    message: "Deferred document close save failed unexpectedly",
    operation: DiagnosticOperation.Save,
    stage: DiagnosticStage.CloseSave,
  });
}

export function reportMarkdownFormatFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.MarkdownFormatFailed, {
    message: "Markdown formatting failed",
    operation: DiagnosticOperation.Validate,
  });
}

export function reportPhotosDecodeFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.PhotosDecodeFailed, {
    message: "Photos image decode failed",
    operation: DiagnosticOperation.Load,
  });
}

export function reportVideoPlaybackError(): void {
  logger?.error(DiagnosticEvent.NativeApp.VideoPlaybackError, {
    message: "Video playback failed",
    operation: DiagnosticOperation.Load,
  });
}

export function reportVideoPlaybackStartFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.VideoPlaybackStartFailed, {
    message: "Video playback start failed",
    operation: DiagnosticOperation.Start,
  });
}

export function reportRecycleBinBatchPartialFailure(
  operation: typeof DiagnosticOperation.Restore | typeof DiagnosticOperation.Delete,
  requestedCount: number,
  completedCount: number,
): void {
  logger?.error(DiagnosticEvent.NativeApp.RecycleBinBatchPartialFailure, {
    message: "Recycle Bin batch action partially completed",
    operation,
    requestedCount,
    completedCount,
  });
}

export function reportRecycleBinRefreshAfterActionFailure(
  operation: typeof DiagnosticOperation.Restore | typeof DiagnosticOperation.Delete,
): void {
  logger?.error(DiagnosticEvent.NativeApp.RecycleBinRefreshAfterActionFailed, {
    message: "Recycle Bin refresh failed after a completed action",
    operation,
  });
}
