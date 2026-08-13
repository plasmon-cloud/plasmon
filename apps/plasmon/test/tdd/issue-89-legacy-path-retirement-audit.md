# #89 legacy path retirement audit

Active legacy assumptions found:

- `build.ts` emits five `monaco-workers/*` outputs.
- `packaging.ts` requires five `dist/web/monaco-workers/*.js` outputs.
- e2e smoke requests `/app/plasmon/monaco-workers/editor.worker.js`.
- `monacoEnvironment.ts` constructs module-relative `./monaco-workers/<file>`.
- docs/tests describe the top-level path as current evidence.

No active `.sys` Monaco resource exists and none may be added. Retirement is
safe only after all supported consumers/tests/package outputs are migrated to an
accepted canonical Program Files transport and installed Worker proof passes.
Do not delete current assumptions before #89 implementation; their presence is
the current RED evidence.
