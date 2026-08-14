# r2 browser-spec execution ledger

Snapshot: post-merge GitHub CI reconciliation against release `82f176a6` on 2026-08-14. No packaged browser session was executed locally; exact merged PR CI is recorded where available. Local absence is an **operational browser block**, not product RED and not HARNESS GAP.

| Issue | spec / reason | local | CI / expected RED | health / artifact | status |
|---|---|---|---|---|---|
| #66 | A drag preview requires real stacking/hit testing | no local session | not in current smoke/specialist scripts | browser interaction artifact; no screenshot required | BROWSER SPEC ONLY / evidence missing |
| #67/#89/#113/#200 | installed Monaco workers/opaque-origin runtime | no session | specialist packaged lane | strict health; worker ready state | BROWSER SPEC ONLY |
| #95 | selected label geometry (distinct from #191) | existing integrated model/browser evidence; no fresh run | packaged smoke | bounds/semantic entry, no screenshot | BROWSER SPEC ONLY |
| #107/#167/#187 | installed common-path smoke | no local session | merged PR smoke CI (`#204`, `#208`, `#210`, `#212`) | strict health + geometry | EXECUTED GREEN in PR CI; post-merge local rerun absent |
| #170/#58 | Review installed workflow | no local session | #204 Vanilla Neutron packaged Review + specialist checks PASS | browser errors surfaced | EXECUTED GREEN (merged PR evidence); current release rerun absent |
| #175/#193 | Search category geometry | no local session | not in current smoke/specialist scripts | exact bounds; retire only #175 allowance | BROWSER SPEC ONLY / evidence missing |
| #180 | Photos expanded/fallback workspace geometry | no local session | no dedicated current spec in specialist script | viewport artifact/geometry | BROWSER SPEC ONLY / evidence missing |
| #181 | fixture enabled → discovery across packaged surfaces | no packet/seam | future packaged lane | package/resource artifact | OPERATIONALLY BLOCKED |
| #186 | close/reload/full browser restart retained profile | PR209 CI evidence; no local rerun | dedicated persistence workflow | NodeId/content/origin assertions | EXECUTED GREEN (integrated CI evidence) |
| #190 | real installed icon request/response under `/app/plasmon/...` | no local session | PR211 smoke/spec PASS; merged into release via #211 | request/response paths; old `/static/...` health allowances remain | EXECUTED GREEN; allowance retirement still pending |
| #191 | FileEntry rename bounds | no local session | PR204 packaged smoke/spec PASS; merged into release | bounds plus #187 health baseline; #95 separate | EXECUTED GREEN (merged PR evidence); no local rerun |
| #192 | Desktop placement rendered adapter | no local session | PR205 packaged smoke PASS; merged release controller/spec | real rendered positions plus lower controller guards | EXECUTED GREEN (merged PR evidence); no local rerun |
| #173 | compact List columns/spatial navigation | no local session | PR212 packaged smoke/spec PASS; merged into release | real rendered columns and geometry-driven keyboard navigation | EXECUTED GREEN (merged PR evidence); no local rerun |
| #202 | js-dos storage under sandbox | no local session | no dedicated current merged proof | canvas/runtime health | BROWSER SPEC ONLY / evidence missing |

No screenshot baseline is required by #187: its visual spike was deterministic and intentionally retired. A successful Playwright parse is not recorded as execution.
