# Text / Monaco editor

Text is the Plasmon native text/code editor built around a packaged Monaco editor surface and an FsService-backed document session.

`document.ts` owns document loading, stable reads, dirty/save/autosave, conflict detection, reload/overwrite, Save As, persistence semantics, and the bounded autosave/flush controls needed while a dirty close is being decided. `documentClose.ts` owns the shared deterministic dirty-close decision model used by both Text and Markdown. `useDocumentSession.ts` and `useDocumentCloseProtection.ts` adapt those production models to React; `DocumentClosePrompt.tsx` is the shared visible Save / Discard / Cancel presentation. `MonacoEditorSurface.tsx` and the Monaco adapter/environment files own editor-engine initialization/workers and browser integration. `editorModel.ts`/`editorChrome.ts` hold reusable editor presentation/model helpers.

Filesystem persistence and document conflict semantics must remain independent of Monaco engine lifecycle so they can be tested without a browser. Ordinary close remains Process-owned: the document model only decides whether an accepted Process request may proceed, must remain deferred, or is cancelled.

For a dirty close, autosave is suspended while the decision is pending. Save completes the deferred request only after the current edits persist successfully; failed save or conflict leaves the document open. Discard suppresses the pending autosave and dispose-time flush for that close. Cancel resumes normal autosave behavior and keeps the dirty process/window alive.

Monaco worker executables are packaged beneath the canonical `/System/Program Files/MonacoEditor` runtime root. That Program Files subtree is the sole logical runtime authority, not an application-installation registry. Ordinary browser contexts construct module Workers from that path directly. The package also retains the URL-safe `runtime/monaco/` serving mirror required by Kernel app-host routing; package tests require every mirrored worker to be byte-identical to Program Files and it carries no independent lifecycle/model authority. Neutron's application frame intentionally has an opaque origin, so worker startup uses the minimum browser compatibility adapter needed by that sandbox. Packaged builds generate one `runtime/monaco/worker-sources.js` preload from the same self-contained worker bundles used for Program Files and the URL-safe mirror. It serializes those bytes as inert strings in the application document. Normal origins continue to execute the canonical Program Files path as module Workers; only the opaque application frame materializes the identical preloaded bytes as `blob:` classic Workers because Chromium rejects `blob:null/...` module Workers there while classic blob Workers execute normally. Package tests require Program Files, the URL-safe mirror, and the preloaded source to agree byte-for-byte. The retired top-level `monaco-workers/` path remains forbidden.

## Refactor direction

Continue sharing document-session, close-decision, command, status, and editor-chrome infrastructure with Markdown/other document apps. Keep Monaco-specific adapters isolated from generic document semantics and expose mature editor capabilities through reusable command models/UI rather than app-specific shortcuts only.

Shared language/type metadata should come from common association/content metadata rather than a Text-only extension table when other OS surfaces need the same answer.

## Testing

Use fast tests for document sessions, dirty-close decisions, conflicts/save/reopen, discard/flush behavior, editor models/commands, language/type mapping, worker route selection, and adapter configuration. Use real-browser/package tests for Monaco creation/readiness, workers/assets, focus/selection, keyboard commands, and the actual rendered close interaction.

The packaged golden-path acceptance creates a real `.txt` document through Explorer, opens it through normal filesystem association/process/window routing, waits for the semantic Monaco readiness contract (`data-editor-engine="monaco"`, `data-editor-ready="true"`, and the `Text content` editor label), edits and saves through the production document session, then closes/reopens and verifies the persisted text from the rendered Monaco model. Keep deterministic save/conflict/session cases in fast tests rather than expanding that browser journey.

The #89 packaged worker acceptance separately runs in installed Chromium and Firefox. Package coverage proves both browser transport forms remain byte-identical to the canonical Program Files workers; browser coverage verifies the installed preload, opaque-origin `blob:` classic-Worker construction, real editor/TypeScript worker message exchange, zero worker errors/fallback warnings, and strict BrowserHealth during worker startup.
