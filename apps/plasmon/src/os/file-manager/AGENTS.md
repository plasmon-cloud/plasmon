# FileManager agent instructions

## Authority

This directory owns reusable filesystem presentation and user file interaction: selection, rename, clipboard, drag/drop, create/import/download, context command UI, Properties/Open With presentation, operation status, and visible errors.

## Rules

- Consume filesystem/core services; never reach into repository/storage internals.
- Generic resource opening delegates to the shared filesystem/association/open path. Do not add filename/type-specific launch switches in React.
- File mutations must respect filesystem resource capabilities/protection rather than bypassing them.
- Keep navigation/history keyed to stable filesystem identity where identity is the intended invariant.
- A NodeId-keyed `FileEntry` must keep its last resolved resource presentation while an authoritative snapshot re-resolves that same resource. Do not reset a stable entry to a generic fallback merely because its `FsNode` object identity changed, and do not replace last-known artwork with a generic fallback merely because asynchronous shortcut enrichment is temporarily unavailable; packaged `<img src>` churn can cancel otherwise-valid installed asset requests. A genuinely new entry may initialize from the synchronous fallback until its first richer resolution succeeds.
- Shared file-operation state must be explicit and injectable where multiple surfaces share it; avoid hidden module-global UI authority.
- FileManager operation progress may report only information the production boundary actually knows: import can expose its sequenced current item, while paste must not fabricate byte or per-item progress that the existing paste helper does not expose.
- Operation-state models coordinate lifecycle/presentation only; `FsService` and existing file-operation helpers retain mutation, collision, and identity semantics.
- Error states must remain visible/reportable and failed async actions must not silently mutate local shadow state.
- Context-menu/keyboard behavior must respect editable targets and the capabilities of the selected resources.

Specific suffixes, rename-width defects, current shortcut bugs, or individual menu omissions belong in Issues/tests, not this generic file.

## Refactor direction

Reduce orchestration in `FileManager.tsx` by extracting production command/action models and deterministic gesture/state logic. Reuse those models across Desktop/Explorer rather than creating surface-specific copies. Do not generalize the bounded FileManager operation model into a system-wide job framework without demonstrated requirements.

## Validation

Use fast tests for models/actions and filesystem effects. Use RTL/browser tests for DOM pointer/keyboard/focus/dialog/file-input/download behavior and accessible operation-status boundaries where browser rendering is material.
