# Future Monaco host failure-state matrix

| Failure/state | Canonical authority | Visible state | Retry? | Dismissal | Test layer |
|---|---|---|---|---|---|
| loading | host/browser dynamic import | loading status, no false ready | only if existing app policy | app remains open | RTL |
| worker request failure | package/browser runtime | explicit worker/editor error | do not invent automatic retry | visible alert/close according to app | Playwright + RTL |
| opaque-origin/security failure | browser sandbox/package | explicit initialization failure; retain security boundary | no silent fallback | app close/retry only accepted policy | Playwright |
| editor initialization failure | Monaco host | error state, no editable false positive | only documented retry | visible error | RTL/browser |
| model creation failure | host/Monaco | error; document session remains independent | no hidden replacement model | app controls remain coherent | Bun adapter + RTL |
| language unavailable | canonical #178 hint/Monaco | safe accepted fallback or visible state defined by app | no classifier duplication | retain document | Bun/RTL |
| model disposal/unmount | host exact owner | no stale editor callbacks | no retry | cleanup | Bun/RTL |
| document load failure | DocumentSession | app-level load error | session authority decides | app close/reopen | Bun/RTL |
| save/conflict failure | DocumentSession | dirty/error/conflict and close remains governed | explicit user command only | Save/Discard/Cancel | Bun/RTL |

Do not classify a worker fallback warning as success merely because a textarea or
editor-looking DOM exists.
