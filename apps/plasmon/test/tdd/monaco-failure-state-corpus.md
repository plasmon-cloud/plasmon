# Monaco failure-state corpus

| failure | expected UI | health | cleanup |
|---|---|---|---|
| Worker URL missing/HTTP error | explicit Monaco failed-to-load alert; no fake ready | request/pageerror failure | dispose editor/model |
| Worker SecurityError/opaque origin | explicit error + strict health RED | #67/#89 allowance only temporarily | no sandbox weakening |
| unsupported label | deterministic editor-worker fallback or explicit unsupported policy | no silent language claim | dispose |
| model creation failure | error alert, document authority survives | pageerror caught by host | no leaked model |
| language unavailable | preserve text, visible fallback language/error | warning policy | model remains owned |
| resource read failure | app alert, no editor content fiction | deterministic app error | session generation prevents stale result |
| resource disappears | conflict/error; no save to replacement path | FS error | session timer/observer cleanup |
| mount/unmount/reopen | ready/error resets correctly | browser lifecycle | editor/model/disposables exact once |

Current `MonacoEditorSurface` exposes loading/error/readiness and owned model
cleanup. Actual Worker error observation remains packaged browser evidence.
