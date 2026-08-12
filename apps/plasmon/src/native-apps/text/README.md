# Text / Monaco editor

Text is the Plasmon native text/code editor built around a packaged Monaco editor surface and an FsService-backed document session.

`document.ts` owns document loading, stable reads, dirty/save/autosave, conflict detection, reload/overwrite, Save As, persistence semantics, and the bounded autosave/flush controls needed while a dirty close is being decided. `documentClose.ts` owns the shared deterministic dirty-close decision model used by both Text and Markdown. `useDocumentSession.ts` and `useDocumentCloseProtection.ts` adapt those production models to React; `DocumentClosePrompt.tsx` is the shared visible Save / Discard / Cancel presentation. `MonacoEditorSurface.tsx` and the Monaco adapter/environment files own editor-engine initialization/workers and browser integration. `editorModel.ts`/`editorChrome.ts` hold reusable editor presentation/model helpers.

Filesystem persistence and document conflict semantics must remain independent of Monaco engine lifecycle so they can be tested without a browser. Ordinary close remains Process-owned: the document model only decides whether an accepted Process request may proceed, must remain deferred, or is cancelled.

For a dirty close, autosave is suspended while the decision is pending. Save completes the deferred request only after the current edits persist successfully; failed save or conflict leaves the document open. Discard suppresses the pending autosave and dispose-time flush for that close. Cancel resumes normal autosave behavior and keeps the dirty process/window alive.

## Refactor direction

Continue sharing document-session, close-decision, command, status, and editor-chrome infrastructure with Markdown/other document apps. Keep Monaco-specific adapters isolated from generic document semantics and expose mature editor capabilities through reusable command models/UI rather than app-specific shortcuts only.

Shared language/type metadata should come from common association/content metadata rather than a Text-only extension table when other OS surfaces need the same answer.

## Testing

Use fast tests for document sessions, dirty-close decisions, conflicts/save/reopen, discard/flush behavior, editor models/commands, language/type mapping, and adapter configuration. Use real-browser/package tests for Monaco creation/readiness, workers/assets, focus/selection, keyboard commands, and the actual rendered close interaction.
