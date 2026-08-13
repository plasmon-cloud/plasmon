# #89 Monaco runtime path authority

## Current map

- Logical managed runtime authority: `/System/Program Files/MonacoEditor` is the
  expected canonical destination from #89; no `MonacoEditor.sys` may be created.
- Current build emits `dist/web/monaco-workers/{editor,json,css,html,ts}.worker.js`.
- Current active consumer is `src/native-apps/text/monacoEnvironment.ts`, which
  constructs a module-relative `./monaco-workers/<worker>` URL.
- Package-local executable mirror is currently analogous to js-dos's
  `runtime/jsdos/` transport: it is an adapter for browser serving, not a second
  logical filesystem authority.
- Text/Markdown React must consume this runtime contract; it must not select a
  guessed legacy root or own Program Files reconciliation.

## Required characterization

1. Clean bootstrap creates exactly one managed Program Files entry/projection.
2. Repeated bootstrap is idempotent and preserves NodeId/data/metadata.
3. Every active worker/runtime asset is referenced through accepted authority or
   an explicitly documented package-local mirror required by serving constraints.
4. No old guessed/static root remains in active consumers.
5. No remote internet request is required.
6. Removing one required asset produces an explicit package/runtime failure, not
   a fake ready editor.

Current package structural tests prove emitted worker files and #57 proves
managed-root reconciliation. They do not yet prove the final installed URL,
Program Files projection, or Worker startup; therefore this is **VERIFIED CORE
RED / INCOMPLETE ACCEPTANCE**, not GREEN.
