# Shared Monaco browser-runtime host

<!-- plasmon-docs-review:v1 sha256=4807afceb014367a021628aa7dc0651adeba6b8decb697018baaca8a4f098804 base=0c9f91b341800f91113aeb269a6438165eb825c8 -->

This directory is the single Monaco browser adapter consumed by the first-party Text and Markdown document applications.

- `MonacoEditorHost.tsx` owns the concrete browser/editor lifecycle: Monaco import/create/dispose, per-live-surface model ownership, loading/ready/error presentation, focus/layout, value synchronization, and language updates.
- `editorModel.ts` owns deterministic model ownership/URI and canonical resource-to-Monaco language policy.
- `monacoEnvironment.ts` consumes the #89 packaged worker transport. `/System/Program Files/MonacoEditor` remains the logical worker-runtime authority; the opaque-origin transport adapter does not become a second authority.

The host does **not** own filesystem/document persistence, dirty/conflict state, Save/Save As/autosave, Process close negotiation, Text/Markdown commands, Markdown preview, or application chrome. Those remain with the document applications and their existing canonical services.

Each mounted editor host owns exactly one concrete Monaco model. Two live surfaces for the same semantic resource intentionally receive different model URIs and dispose only their own model. Semantic document identity remains outside Monaco model-registry identity.

Fast tests cover deterministic model/language/worker policy. Installed Chromium/Firefox acceptance remains authoritative for real worker startup, sandbox/origin behavior, Monaco readiness, focus, and rendered editing.
