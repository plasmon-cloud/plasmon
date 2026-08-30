# Shared Monaco browser-runtime host

This directory is the single Monaco browser adapter consumed by the first-party Text and Markdown document applications.

- `MonacoEditorHost.tsx` owns the concrete browser/editor lifecycle: Monaco import/create/dispose, per-live-surface model ownership, loading/ready/error presentation, focus/layout, value synchronization, and language updates.
- `editorModel.ts` owns deterministic model ownership/URI and canonical resource-to-Monaco language policy.
- `monacoEnvironment.ts` consumes the packaged worker transport. `/System/Program Files/MonacoEditor` remains the sole logical worker-runtime authority; the opaque-origin transport adapter is only a browser compatibility transport and does not become a second authority.

## Package tiers and worker mapping

Editor-capable package tiers use explicit worker inventories:

- **Slim** ships only `editor.worker.js`. Every Monaco worker label resolves to that Program Files editor-worker source, and dedicated language-service features are disabled. JavaScript language classification and syntax tokenization remain editor behavior even though the dedicated language-service workers are omitted.
- **Base** is the ordinary/default Plasmon tier and ships `editor.worker.js`, `json.worker.js`, `css.worker.js`, `html.worker.js`, and `ts.worker.js`. JSON, CSS/SCSS/Less, HTML/Handlebars/Razor, and TypeScript/JavaScript labels map to their corresponding dedicated Program Files workers.
- **Demo** is an overlay on Base, not a package tier. Enabling Demo content does not change the Base Monaco worker inventory or routing.

Package-tier and Demo-overlay selection are build/composition concerns. Do not infer worker availability from a release branch, work item, deployment app inventory, or historical acceptance packet. Optional heavyweight runtime configuration is separate from Monaco package-tier selection.

## Browser transport

Program Files remains the logical source for Monaco worker runtime identity. Packaged builds also retain the URL-safe `runtime/monaco/` serving mirror required by application-host routing, and package verification requires the mirror to remain byte-identical to the corresponding Program Files worker output.

Normal browser origins construct module Workers directly from the canonical Program Files path. Neutron application frames intentionally have an opaque origin, where Chromium rejects module Workers backed by `blob:null/...` URLs even when the Blob was created by the same frame. Packaged builds therefore preload the same self-contained worker bytes as inert source strings. Only the opaque application frame materializes those identical bytes as classic `blob:` Workers.

This is one worker implementation with two browser transports, not two runtime authorities. The retired top-level `monaco-workers/` path must not be reintroduced.

The host does **not** own filesystem/document persistence, dirty/conflict state, Save/Save As/autosave, Process close negotiation, Text/Markdown commands, Markdown preview, or application chrome. Those remain with the document applications and their existing canonical services.

Each mounted editor host owns exactly one concrete Monaco model. Two live surfaces for the same semantic resource intentionally receive different model URIs and dispose only their own model. Semantic document identity remains outside Monaco model-registry identity.

## Testing

Use fast tests for deterministic model/language/worker mapping and transport policy. Package verification must prove the Program Files workers, URL-safe mirror, and opaque-frame preload remain byte-identical for every worker present in the selected tier. Installed-browser acceptance is authoritative for real Worker construction and language-service behavior that depends on browser execution.
