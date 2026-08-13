# #202 call-chain audit

The current repository does not contain the expanded vendored js-dos bundle in
source; it is produced by `build.ts` from the pinned js-dos 8.4.1 package and
copied under Program Files and `runtime/jsdos`. The canonical #202 evidence
identifies calls emitted by that installed bundle:

```text
JsDosPlayer start
 -> js-dos bootstrap/storage capability probe
 -> StorageManager.estimate()  [unsupported-context TypeError]
 -> storage directory/OPFS access [sandbox SecurityError]
 -> player continues to real ready/canvas state
```

The call is therefore optional-to-player readiness in the observed run but is a
browser-health defect because it emits uncaught/console errors and may affect
persistence. Exact minified function names must be captured from the installed
archive/source map by the future owner; no source-level vendor guess is made.
Host adaptation points are `loadJsDosRuntime`, `startJsDosPlayer`, and the
runtime asset boundary. Do not edit vendor bytes in this TDD lane.
