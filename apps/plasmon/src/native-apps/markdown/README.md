# Markdown editor

Markdown is a Plasmon native document application built on the shared Monaco editor surface/document session from `../text/` plus a sanitized rendered preview.

`MarkdownEditor.tsx` coordinates edit/split/preview presentation. `MarkdownPreview.tsx` and `render.ts` own rendered Markdown presentation/sanitization. Loading, dirty state, save/conflict behavior, persistence, and dirty-close decisions reuse the shared Text document infrastructure, including the same deterministic close model and Save / Discard / Cancel prompt.

Markdown does not own a second lifecycle policy. Ordinary close remains Process-owned; Markdown supplies only the same document decision semantics as Text. Failed save/conflict keeps the deferred close pending, Discard suppresses persistence of the dirty edits for that close, and Cancel keeps the process/window alive.

## Refactor direction

Keep Markdown-specific concerns limited to Markdown modes/rendering and commands. Editor engine lifecycle, filesystem document persistence, conflict handling, dirty-close behavior, and common editor chrome should stay shared with Text/other document applications.

If formatting or richer Markdown tooling is added, expose it through reusable command models rather than embedding one-off keyboard/UI logic throughout the component.

## Testing

Use fast tests for rendering/sanitization, mode visibility, Markdown commands, and shared document/close semantics. Use real-browser/package tests for Monaco/workers, the actual rendered dirty-close interaction, split-pane focus/layout, editor commands, and rendered-link/browser behavior where DOM/engine behavior matters.
