# Luna-A packet quality audit — independent repair validation

Audit date: 2026-08-13. Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

A packet is marked verified only where canonical criteria map to executable
production behavior or explicitly existing evidence. Browser parsing is never
verification.

| Issue | Canonical acceptance -> executable evidence -> outcome -> uncovered criterion |
|---|---|
| #44 | shortcut primitive -> existing Bun tests -> CHARACTERIZATION ONLY -> none identified |
| #51 | Send Desktop consumer -> RTL missing command + real helper headless tests -> VERIFIED CORE RED / INCOMPLETE -> command failure/UI and repeated consumer journey |
| #52 | shared presentation consumer -> Visual/file-icon characterization -> CHARACTERIZATION ONLY -> accepted #190 migration |
| #65 | multi-file progress/partial failure/paste/duplicate protection -> repaired 3-test RTL packet, current status absent -> VERIFIED CORE RED / INCOMPLETE -> production seam integration/headless transitions |
| #66 | top-level stack + transparent hit testing + real drop/cleanup -> repaired Playwright gate -> BROWSER SPEC ONLY -> execution blocked |
| #86 | Selection API and drag distinction -> repaired Playwright gate -> BROWSER SPEC ONLY -> execution blocked |
| #92 | integrated #65 state inspected; drag delayed-move status gate -> TDD:RTL RED -> current drag path has no operation lifecycle |
| #93 | containment/aspect/lifecycle -> Bun green + new visual browser gate -> CHARACTERIZATION ONLY -> browser execution remains uncovered |
| #94 | bounded media policy -> policy document only -> BROWSER SPEC ONLY -> production eligibility/lifecycle seam and fixture |
| #95 | selected overlay geometry distinct from rename editor -> dedicated browser gate -> BROWSER SPEC ONLY -> execution blocked |
| #108 | navigation model -> existing Bun/RTL/browser characterization -> CHARACTERIZATION ONLY -> no missing lower-layer criterion |
| #110 | toggle/reopen/reload persistence -> repaired semantic packaged gate -> BROWSER SPEC ONLY -> execution blocked |
| #115 | shared commands with >=2 consumers -> existing outcomes only -> CHARACTERIZATION ONLY -> implementation required |
| #171 | resolver safety + installed Element no-storm -> deterministic green + browser plan -> BROWSER SPEC ONLY -> installed browser execution |
| #172 | integrated #192 + real Trash composed free/occupied restore gate -> exact release-head detached execution -> ALREADY GREEN -> 2 passed, 13 expects |
| #173 | deliberate compact multi-column List + spatial keyboard -> revised browser gate -> VERIFIED CORE RED / INCOMPLETE -> execution and lower common semantics |
| #174 | one `.sys` result + hidden/running/identity/activation -> headless core RED + characterizations -> VERIFIED CORE RED / INCOMPLETE -> final vocabulary/Start consistency |
| #176 | owned/foreign event boundary -> no production seam, matrix only -> RECONNAISSANCE -> seam and browser propagation |
| #178 | classifier matrix -> invalid test deleted, waits for #189 -> WAIT FOR DEPENDENCY -> accepted classifier |
| #189 | canonical classifier -> PR #207 and existing RED -> WAIT FOR DEPENDENCY -> release integration |
| #190 | installed Plasmon asset success/no #190 failure -> strict-health gate repaired -> BROWSER SPEC ONLY -> execution and allowance removal |
| #191 | bounded rename editor -> existing geometry packet/PR #204 -> WAIT FOR DEPENDENCY -> integration/rerun |
| #192 | placement controller -> integrated #192 tests and browser adapter packet -> CHARACTERIZATION ONLY -> independent packaged geometry execution remains blocked |
| #195 | decomposition behavior -> existing lower-layer guards, no source-shape test -> CHARACTERIZATION ONLY -> inspect post-#191 |
| #196 | explicit strategies -> final packet consumes merged #195 seams -> FINAL PACKET READY |
| #186 | persistence matrix -> Testing Lead PR #209 merged in final release -> RECONNAISSANCE -> explicit Testing Lead handoff, no Luna ownership |
| #193/#194 | source/consumer readiness -> refreshed readiness audits -> RECONNAISSANCE -> owning implementation |
| #201 | cleanup candidates -> release inspection after #192 -> RECONNAISSANCE -> accepted migration evidence |

## Repairs independently checked

- #66 now contains actual stack/hit/drop/cancel observations, not a z-index or
  preview-existence claim.
- #173 now requires the opposite of the old vertical full-width defect.
- #178 contains no fictional signature or out-of-contract image helper test.
- #182 uses production Explorer projection in RTL; no hard-coded Favorites list.
- #95 is dedicated and explicitly reconciles with #191's separate editor gate.
- #93 is split deterministic green from browser-pending acceptance.
- #115 is implementation-required despite green externally visible outcomes.
- #192 integration is reflected; #186 is explicitly Testing Lead handoff.
