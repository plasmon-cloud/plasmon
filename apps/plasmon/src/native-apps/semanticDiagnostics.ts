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

export function reportDocumentLoadFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.DocumentLoadFailed, {
    message: "Document content decoding failed",
    operation: DiagnosticOperation.Load,
  });
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
  });
}

export function reportBrowserTargetResolveFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.BrowserTargetResolveFailed, {
    message: "Browser target interpretation failed",
    operation: DiagnosticOperation.Open,
  });
}

export function reportPhotosDecodeFailure(): void {
  logger?.notice(DiagnosticEvent.NativeApp.PhotosDecodeFailed, {
    message: "Photos image decode failed",
    operation: DiagnosticOperation.Load,
  });
}

export function reportVideoSourceResolveFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.VideoSourceResolveFailed, {
    message: "Video target interpretation failed",
    operation: DiagnosticOperation.Open,
  });
}

export function reportVideoPlaybackError(): void {
  logger?.notice(DiagnosticEvent.NativeApp.VideoPlaybackError, {
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

export function reportExplorerFavoritesRefreshFailure(): void {
  logger?.error(DiagnosticEvent.NativeApp.ExplorerFavoritesRefreshFailed, {
    message: "File Explorer Favorites refresh failed",
    operation: DiagnosticOperation.Read,
  });
}

function reportRecycleBinBatchPartialFailure(
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

export function reportRecycleBinRestorePartialFailure(
  requestedCount: number,
  completedCount: number,
): void {
  reportRecycleBinBatchPartialFailure(DiagnosticOperation.Restore, requestedCount, completedCount);
}

export function reportRecycleBinDeletePartialFailure(
  requestedCount: number,
  completedCount: number,
): void {
  reportRecycleBinBatchPartialFailure(DiagnosticOperation.Delete, requestedCount, completedCount);
}

function reportRecycleBinRefreshAfterActionFailure(
  operation: typeof DiagnosticOperation.Restore | typeof DiagnosticOperation.Delete,
): void {
  logger?.error(DiagnosticEvent.NativeApp.RecycleBinRefreshAfterActionFailed, {
    message: "Recycle Bin refresh failed after a completed action",
    operation,
  });
}

export function reportRecycleBinRefreshAfterRestoreFailure(): void {
  reportRecycleBinRefreshAfterActionFailure(DiagnosticOperation.Restore);
}

export function reportRecycleBinRefreshAfterDeleteFailure(): void {
  reportRecycleBinRefreshAfterActionFailure(DiagnosticOperation.Delete);
}
