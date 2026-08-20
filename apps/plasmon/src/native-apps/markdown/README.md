# Markdown editor

Markdown is a Plasmon native document application built on the shared Monaco browser-runtime host in `../shared/monaco/`, the shared document session from `../text/`, and a sanitized rendered preview.

`MarkdownEditor.tsx` coordinates edit/split/preview presentation. `MarkdownPreview.tsx` and `render.ts` own rendered Markdown presentation/sanitization. Loading, dirty state, save/conflict behavior, persistence, and dirty-close decisions reuse the shared Text document infrastructure, including the same deterministic close model and Save / Discard / Cancel prompt. Monaco editor/model/worker lifecycle is not Text- or Markdown-owned; both apps consume `MonacoEditorHost`.

Markdown does not own a second lifecycle or autosave policy. Like Text, it uses the shared document-session default of explicit Save with autosave OFF. Any future autosave opt-in must continue to come through the shared document-session/preference authority rather than Markdown-private persistence, and it must retain the same conflict/error and dirty-close semantics.

Ordinary close remains Process-owned; Markdown supplies only the same document decision semantics as Text. Failed save/conflict keeps the deferred close pending, Discard suppresses persistence of the dirty edits for that close, and Cancel keeps the process/window alive.

## Editor commands and formatting

Markdown uses the shared Monaco command API for Find, Replace, and Go to line, plus the same app-controlled word-wrap and minimap options as Text. These are visible Markdown toolbar affordances; Markdown does not duplicate Monaco action IDs or browser/editor lifecycle logic.

The window title follows the accepted document-aware editor identity: `<filename> - Monaco Editor` (with `Untitled - Monaco Editor` as the empty-name fallback). The former `Monaco ready` engine badge is not user-facing editor chrome.

`markdownFormatter.ts` owns the deliberately conservative built-in Markdown formatter. It normalizes line endings, whitespace-only blank lines, excessive blank-line runs, and the final newline outside fenced code. It preserves nonblank trailing whitespace so Markdown hard breaks remain meaningful, and it preserves fenced-code content apart from line-ending normalization. Formatting writes back through the normal document session, so a changed result participates in ordinary dirty/save/conflict/close behavior. Formatter absence or exceptions return the original source unchanged and surface feedback instead of corrupting the document.

## Refactor direction

Keep Markdown-specific concerns limited to Markdown modes/rendering, formatting, and commands. Editor browser lifecycle stays in `../shared/monaco/`; filesystem document persistence, conflict handling, and dirty-close behavior remain in shared document infrastructure rather than the editor host.

If formatting or richer Markdown tooling is extended, keep deterministic Markdown policy in reusable Markdown-owned models and continue consuming the shared Monaco command surface instead of embedding action IDs or editor internals throughout the React component.

## Testing

Use fast tests for rendering/sanitization, mode visibility, Markdown formatter/title/config policy, shared document/close semantics, and shared Monaco host policy. Use real-browser/package tests for Monaco/workers, the actual rendered dirty-close interaction, split-pane focus/layout, visible editor commands, formatter interaction, and rendered-link/browser behavior where DOM/engine behavior matters.

The packaged golden-path acceptance creates a real `.md` document through Explorer, opens it through normal filesystem association/process/window routing, waits for the shared semantic Monaco readiness contract (`data-editor-engine="monaco"`, `data-editor-ready="true"`, and the `Markdown source` editor label), edits and saves through the production document session, then closes/reopens and verifies the persisted source from the rendered Monaco model. Keep deterministic Markdown/session behavior in fast tests rather than duplicating it in Playwright.
