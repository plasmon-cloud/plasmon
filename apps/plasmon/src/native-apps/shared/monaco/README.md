# Shared Monaco browser-runtime host

This directory is the single Monaco browser adapter consumed by the first-party Text and Markdown document applications.

- `MonacoEditorHost.tsx` owns the concrete browser/editor lifecycle: Monaco import/create/dispose, per-live-surface model ownership, loading/ready/error presentation, focus/layout, value synchronization, and language updates.
- `editorModel.ts` owns deterministic model ownership/URI and canonical resource-to-Monaco language policy.
- `monacoEnvironment.ts` consumes the packaged worker transport. `/System/Program Files/MonacoEditor` remains the sole logical worker-runtime authority; the opaque-origin transport adapter is only a browser compatibility transport and does not become a second authority.

## Package profiles and worker mapping

Editor-capable package profiles use explicit profile-specific worker inventories:

- `slim` and `demo` package profiles ship only `editor.worker.js`. Every Monaco worker label, including TypeScript/JavaScript language-service labels, resolves to that Program Files editor-worker source in these profiles. JavaScript language classification and syntax tokenization remain editor behavior even though heavyweight dedicated language-service workers are omitted.
- `full` ships the dedicated editor, JSON, CSS, HTML, and TypeScript workers. Worker labels map to those corresponding Program Files resources.
- the Hackathon core profile omits Monaco/editor payloads entirely. That is an intentional supported package-profile boundary, not a broken editor installation.

Package-profile selection is a build/composition concern. Do not infer worker availability from a release branch, work item, or historical acceptance packet, and do not restore heavyweight workers to a slim profile merely to satisfy an older test expectation.

## Browser transport

Program Files remains the logical source for Monaco worker runtime identity. Packaged builds also retain the URL-safe `runtime/monaco/` serving mirror required by application-host routing, and package verification requires the mirror to remain byte-identical to the corresponding Program Files worker output.

Normal browser origins construct module Workers directly from the canonical Program Files path. Neutron application frames intentionally have an opaque origin, where Chromium rejects module Workers backed by `blob:null/...` URLs even when the Blob was created by the same frame. Packaged builds therefore preload the same self-contained worker bytes as inert source strings. Only the opaque application frame materializes those identical bytes as classic `blob:` Workers.

This is one worker implementation with two browser transports, not two runtime authorities. The retired top-level `monaco-workers/` path must not be reintroduced.

The host does **not** own filesystem/document persistence, dirty/conflict state, Save/Save As/autosave, Process close negotiation, Text/Markdown commands, Markdown preview, or application chrome. Those remain with the document applications and their existing canonical services.

Each mounted editor host owns exactly one concrete Monaco model. Two live surfaces for the same semantic resource intentionally receive different model URIs and dispose only their own model. Semantic document identity remains outside Monaco model-registry identity.

## Testing

Use fast tests for deterministic model/language/worker mapping and transport policy. Package verification must prove the Program Files workers, URL-safe mirror, and opaque-frame preload remain byte-identical for every worker present in the selected profile. Installed-browser acceptance remains authoritative for real worker startup, sandbox/origin behavior, Monaco readiness, focus, and rendered editing.
