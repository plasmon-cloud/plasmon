# Issue #67 — real Monaco worker/browser acceptance contract

Status: **BROWSER SPEC ONLY**. Deterministic worker-label routing is already
covered by `monacoAdapter.test.ts`; a visible editor div is not proof of worker
creation or communication.

## Required real evidence

Through normal packaged Text and Markdown open routes:

- capture worker creation/request URL and confirm it resolves from the accepted
  #89 `/System/Program Files/MonacoEditor` package path once integrated;
- wait for real Monaco readiness markers (`data-editor-engine="monaco"`,
  `data-editor-ready="true"`, correct editor accessible label);
- observe no SecurityError, unexpected page error, or worker fallback warning
  outside accepted health allowances;
- edit, save, close, reopen and confirm persisted content through real app paths;
- verify Text and Markdown language/labels from canonical #178 input;
- open Text A, Text B, and Markdown C where the product supports concurrent
  surfaces; verify closing one disposes only its own model;
- preserve opaque-origin sandbox/security rather than relaxing isolation.

## Layer split

Bun: worker label mapping, model owner identity/disposal, document/session,
close negotiation and save/conflict semantics. RTL: semantic loading/error/ready
states and app controls. Playwright: actual worker/runtime, Monaco focus/typing,
package URL and rendered editor boundary.
