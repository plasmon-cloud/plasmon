# #67 worker observability packet

**Disposition: PACKAGED BROWSER SPEC ONLY.** Existing Bun tests prove label
selection and model ownership. Existing packaged tests prove a visible,
ready-marked Monaco surface and edit/save/reopen. Neither proves a Worker was
created, loaded, communicated with, or stayed healthy. The historical Firefox
`moz-nullprincipal` SecurityError is canonical RED evidence.

## Gate

1. Install the manifest-driven Plasmon package in the real Neutron sandbox.
2. Open Text and Markdown through filesystem -> AssociationRegistry ->
   OpenService, not a direct component launch.
3. Capture `Worker` construction and the requested worker URL (or observe the
   equivalent browser request plus a worker message/health handshake).
4. Require successful response/creation for `editor.worker.js`; exercise a
   language requiring a language worker where practical (JSON/JS/Markdown).
5. Require explicit editor readiness, focus, an edit, and a normal save/reopen.
6. Fail on unexpected `SecurityError`, ORB/CORS failure, pageerror, console
   worker failure, failed first-party request, or worker fallback warning.
7. Run Chromium and Firefox when the installed acceptance matrix is available.

A visible `.monaco-editor` node, `data-editor-ready`, or a successful HTTP GET
alone is insufficient. The assertion must distinguish request success from
Worker creation/communication. The observer may use browser instrumentation;
it must not patch Monaco, replace Worker, grant `allow-same-origin`, or weaken
CSP/sandbox.

## Layer authority

| claim | lowest truthful layer |
|---|---|
| label -> worker filename | Bun `monacoEnvironment` test |
| model identity/disposal | Bun model-owner tests |
| document/save/dirty/close | Bun DocumentSession + RTL controls |
| package output and URL | package test |
| Worker startup/security/editor operation | installed Playwright |

Existing evidence: `test/e2e/plasmon-monaco-packaged.spec.ts`,
`test/e2e/plasmon-refactor-smoke.spec.ts`, `text/monacoAdapter.test.ts`, and
#187's scoped allowances. Missing evidence is actual Worker startup and
communication, especially Firefox opaque-origin behavior.
