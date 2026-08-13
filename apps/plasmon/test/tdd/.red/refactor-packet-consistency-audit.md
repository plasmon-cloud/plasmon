# r2 packet consistency audit — repaired

Audit date: 2026-08-13. Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

This audit independently compares canonical acceptance, executable evidence and
actual production vocabulary. It is not evidence merely because the prior audit
said so.

| Issue | Canonical acceptance vs evidence | Current outcome | Remaining uncovered criterion |
|---|---|---|---|
| #44 | Existing primitive tests cover stable shortcut serialization/collision | CHARACTERIZATION ONLY | no new gap |
| #51 | RTL missing command RED; headless primitive consumer fence now exercises real helper | VERIFIED CORE RED / INCOMPLETE | actual Send-to-Desktop production command journey and ineligible UI error |
| #52 | Consumer behavior is covered through Visual/file-icon tests and #190 dependency | CHARACTERIZATION ONLY | migration after accepted #190 |
| #65 | Three RTL gates now use 2 imports, current item, partial failure, duplicate trigger and paste vocabulary; current production has no status | VERIFIED CORE RED / INCOMPLETE | production model integration and full headless transition tests |
| #66 | Browser gate now checks real multi-drag, overlapping native window, temporary stack probe, normal hit testing, drop, Escape cleanup | BROWSER SPEC ONLY | packaged execution blocked; actual destination outcome should be confirmed |
| #86 | Browser gate uses Selection API, diagnostic role, no drag and ordinary drag | BROWSER SPEC ONLY | packaged execution blocked |
| #92 | No gate claims a competing operation model | WAIT FOR DEPENDENCY | #65 PR is open, not integrated |
| #93 | deterministic containment/cleanup green; new portrait/landscape/square browser gate | CHARACTERIZATION ONLY | actual packaged visual execution |
| #95 | dedicated browser gate separates selected-label overlay from #191 bounded rename editor | BROWSER SPEC ONLY | packaged execution blocked |
| #108 | existing navigation model/RTL/browser characterization | CHARACTERIZATION ONLY | no missing deterministic criterion identified |
| #110 | real packaged toggle/reopen/reload gate, no swallowed setup catch | BROWSER SPEC ONLY | packaged execution blocked |
| #115 | outcomes green, but no shared command seam or two-consumer proof | CHARACTERIZATION ONLY / IMPLEMENTATION REQUIRED | bounded production command layer |
| #171 | resolver tests green; installed Element request/fallback/no-storm gate remains unexecuted | CHARACTERIZATION ONLY + BROWSER SPEC | installed browser evidence |
| #172 | #192 integrated pure tests plus real Trash/restore/placement composed gate | VERIFIED CLOSURE EVIDENCE PENDING EXECUTION | exact integrated-head rerun and coordinator closure |
| #173 | revised gate requires multi-column compact List and spatial ArrowRight, unlike current vertical full-width List | VERIFIED CORE RED / INCOMPLETE | packaged execution and common semantics characterization |
| #174 | core duplicate RED plus hidden/running/identity/activation characterization | VERIFIED CORE RED / INCOMPLETE | final accepted native projection/type vocabulary |
| #176 | no production event-policy seam; propagation matrix only | RECONNAISSANCE | production seam and representative browser gate |
| #178 | invalid cast/helper test deleted; actual accepted classifier not integrated | WAIT FOR DEPENDENCY | #189 seam then full matrix |
| #189 | current RED/PR implementation separate from this branch; no invented #178 API | WAIT FOR DEPENDENCY | release integration and downstream evidence |
| #190 | strict #187 baseline retains unrelated allowances and omits only #190 icon allowances | BROWSER SPEC ONLY / REAL DEFECT | packaged execution and allowance removal |
| #191 | existing geometry packet targets bounded rename editor, not selected labels | WAIT FOR DEPENDENCY | PR #204 integration and rerun |
| #192 | integrated controller and tests inspect actual release implementation | VERIFIED INTEGRATED | #172 composed closure evidence |
| #195 | characterization only, no source-shape gate | CHARACTERIZATION ONLY | inspect after #191 |
| #196 | reconnaissance intentionally architecture-deferred | WAIT FOR DEPENDENCY | #195 implementation seam |
| #186 | matrix handed to Testing Lead PR #209, now merged | RECONNAISSANCE | no Luna ownership |
| #193/#194 | readiness docs separate source authority, visible uniqueness and React extraction | RECONNAISSANCE/READINESS | owning implementation packets |
| #201 | current release inspected; #192 no longer a wait condition | RECONNAISSANCE/READINESS | accepted migration consumer proof |

## Invalid packets repaired

- #66 no longer asserts preview visibility/pointer-events as stacking proof only.
- #173 no longer preserves the vertical-list defect or asserts ArrowRight must
  not move; it requires compact multi-column geometry.
- #178 no longer casts a one-argument production function or tests an image
  helper outside its contract; it waits for #189.
- #182 no longer uses a test-local Favorites path list; RTL opens production
  Explorer and compares actual projection to actual root inventory.
- #95 now has its own browser gate and is not attributed to #191.
- #93 is no longer declared complete green before browser visual evidence.
- #115 is no longer called implemented/green; it is characterization-ready and
  implementation-required.

## Browser validation rule

Every browser row above is either independently executed, code-inspected only,
or browser-blocked in the final report. Playwright parsing is not verification.
