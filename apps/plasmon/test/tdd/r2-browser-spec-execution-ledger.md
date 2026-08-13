# r2 browser-spec execution ledger

Snapshot: no packaged browser session was executed locally; `local.ndeploy.json` exists, but the required running `local.ndeploy.session.json`/PocketIC session was not established. This is an **operational browser block**, not product RED and not HARNESS GAP.

| Issue | spec / reason | local | CI / expected RED | health / artifact | status |
|---|---|---|---|---|---|
| #66 | A drag preview requires real stacking/hit testing | no session | specialist browser; preview above window stack | browser interaction artifact; no screenshot required | BROWSER SPEC ONLY |
| #67/#89/#113/#200 | installed Monaco workers/opaque-origin runtime | no session | specialist packaged lane | strict health; worker ready state | BROWSER SPEC ONLY |
| #95 | selected label geometry (distinct from #191) | existing integrated model/browser evidence; no fresh run | packaged smoke | bounds/semantic entry, no screenshot | BROWSER SPEC ONLY |
| #107/#167/#187 | installed common-path smoke | no fresh run | packaged smoke CI | strict health + geometry | BROWSER SPEC ONLY |
| #170 | Review installed workflow | PR206 evidence exists; no fresh run | specialist Review lane | browser errors surfaced | EXECUTED GREEN (PR evidence) |
| #175/#193 | Search category geometry | no session | packaged geometry gate | exact bounds; retire only #175 allowance | BROWSER SPEC ONLY |
| #180 | Photos expanded/fallback workspace geometry | no session | specialist browser | viewport artifact/geometry | BROWSER SPEC ONLY |
| #181 | fixture enabled → discovery across packaged surfaces | no packet/seam | future packaged lane | package/resource artifact | OPERATIONALLY BLOCKED |
| #186 | close/reload/full browser restart retained profile | PR209 CI evidence; no local rerun | dedicated persistence workflow | NodeId/content/origin assertions | EXECUTED GREEN (integrated CI evidence) |
| #190 | real installed icon request/response under `/app/plasmon/...` | no session | PR211 focused packaged lane | strict health; request/response paths | BROWSER SPEC ONLY; active PR |
| #191 | FileEntry rename bounds | no session | packaged smoke/spec in PR204 | bounds plus #187 health baseline | BROWSER SPEC ONLY; active PR |
| #202 | js-dos storage under sandbox | no session | specialist runtime lane | canvas/runtime health | BROWSER SPEC ONLY |

No screenshot baseline is required by #187: its visual spike was deterministic and intentionally retired. A successful Playwright parse is not recorded as execution.
