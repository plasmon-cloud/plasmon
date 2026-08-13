# Native-app refactor preservation pack

Every structural refactor must preserve: canonical application/handler identity;
`.sys` projection only for actual user-launchable apps; runtime-only host
separation; FS NodeId/open association; Process/Window authority; document
bytes/save/conflict/dirty/close; Text/Markdown shared session; Markdown
sanitization/preview; Photos/Video object URL and explicit browser failures;
Browser sandbox/foreign iframe boundary; runtime package-local assets,
Worker/WASM/canvas readiness; js-dos Keyboard Lock adaptation; EmulatorJS token
lifecycle; Review standalone Atom/revision/history/portability; explicit fixture
flags; no remote assets; cleanup and stale-result guards.

Permanent references: `src/os/process/process.test.ts`, `text/document.test.ts`,
`documentClose.test.ts`, `monacoAdapter.test.ts`, native media/runtime tests,
`test/headlessEnvironment.test.ts`, package tests, `test/e2e` specialist specs,
and `apps/review/test`/`apps/review/e2e`. Browser green never supersedes lower
authority tests and source presence never supersedes installed proof.
