# Shared Monaco browser-runtime host


This directory is the single Monaco browser adapter consumed by the first-party Text and Markdown document applications.

- `MonacoEditorHost.tsx` owns the concrete browser/editor lifecycle: Monaco import/create/dispose, per-live-surface model ownership, loading/ready/error presentation, focus/layout, value synchronization, and language updates.
- `editorModel.ts` owns deterministic model ownership/URI and canonical resource-to-Monaco language policy.
- `monacoEnvironment.ts` consumes the #89 packaged worker transport. `/System/Program Files/MonacoEditor` remains the logical worker-runtime authority; the opaque-origin transport adapter does not become a second authority.

The r2 slim package intentionally ships only `editor.worker.js`. Every Monaco worker label, including TypeScript/JavaScript language-service labels, resolves to that Program Files editor-worker source in slim mode, while the opaque Neutron frame receives byte-identical preloaded bytes through the `blob:` compatibility transport. The packaged browser acceptance compares the URL-safe HTTP mirror and opaque preload with the package's Program Files output on disk; it does not request the space-containing path through Kernel's rejecting HTTP boundary. JavaScript language classification and syntax tokenization remain required editor behavior even though the heavyweight `ts.worker.js` language-service payload is omitted.

The historical #89 requirement for dedicated full TypeScript/JavaScript language-service workers is therefore **FUTURE/SUPERSEDED for r2**. Product parity is owned by #527 and is blocked by the #526 profile/size guarantee; #370 owns only the later heavyweight/on-demand runtime-delivery architecture. Full-profile worker mapping remains supported as profile-specific policy and must not be restored to the slim artifact merely to satisfy the obsolete acceptance.

The host does **not** own filesystem/document persistence, dirty/conflict state, Save/Save As/autosave, Process close negotiation, Text/Markdown commands, Markdown preview, or application chrome. Those remain with the document applications and their existing canonical services.

Each mounted editor host owns exactly one concrete Monaco model. Two live surfaces for the same semantic resource intentionally receive different model URIs and dispose only their own model. Semantic document identity remains outside Monaco model-registry identity.

Fast tests cover deterministic model/language/worker policy. Installed Chromium/Firefox acceptance remains authoritative for real worker startup, sandbox/origin behavior, Monaco readiness, focus, and rendered editing.
