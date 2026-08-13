# #89 / #200 Program Files boundary

Current integrated release evidence:

- `build.ts` emits `monaco-workers/editor.worker`, `json.worker`,
  `css.worker`, `html.worker`, and `ts.worker` as a separate package output;
- `monacoEnvironment.ts` resolves `./monaco-workers/<file>` relative to the
  module;
- js-dos already establishes `/System/Program Files/js-dos` as the curated
  packaged-runtime pattern.

Future #89 must establish the accepted `/System/Program Files/MonacoEditor`
asset path and update build/runtime verification. #200 consumes that path as a
worker bootstrap input; it must not create a filesystem `MonacoEditor.sys`,
change document authority, or choose a divergent worker root.

Deterministic tests can prove label-to-worker-name selection. Only packaged
browser tests can prove installed request URL, Worker construction,
opaque-origin behavior, and actual Monaco communication.
