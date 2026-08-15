# Luna-B r2 promotion audit

Audit target refreshed from origin immediately before review:

- release: `origin/release/0.1.0-r2`
- exact release SHA: `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`
- staging lane: `tdd/r2/luna-b-shell`
- staging head: `e3010e22bf8ceba1cc3e74c746eb119ac5609eec`

This audit checks promotion evidence rather than treating a finalized packet as implementation evidence. Focused release verification at `56752dc` passed **70 tests / 284 assertions** across Shell, Windowing, Visual, runtime-only, taskbar, and document-close paths. Additional Windowing/taskbar verification passed **12 tests / 45 assertions**.

## Lane-B queue audit

There are **9** Lane-B queue entries. No Lane-B entry is currently `[~]`; the two genuine unconsumed REDs remain explicitly open below.

| Issue | disposition / packet | intentional executable RED? | RED file(s); original RED SHA | implementation PR/commit | permanent regression after implementation | current GREEN? | merged into r2? | audit disposition |
|---|---|---|---|---|---|---|---|---|
| #61 | `issue-61-acceptance-map.md`; characterization `.red` | NO — no honest structural RED | `issue-61.characterization.ui.test.tsx`; characterization staged against `e815c463`, not a corrective failure | none; controller seam remains #197-owned | `src/os/shell/interactions.test.ts`, `shell.test.ts`, packaged RTL Start/Search/refactor guard | YES | YES for current behavior/tests; no controller extraction | CHARACTERIZATION ONLY |
| #63 | `luna-b-r2-runway.md`; `issue-63-browser-adoption.md` | YES | `.red/issue-63.red.ui.test.tsx`; original gate staged against `e815c463`; re-run at `56752dc` still has 2 failures | none found in release or remote implementation refs | none; WindowManager MRU tests are not an Alt-Tab regression | NO | RED NOT YET CONSUMED |
| #72 | `issue-72-acceptance-map.md` | NO — accepted projection already green | no intentional RED; integrated taskbar projection history predates the packet | integrated Shell/taskbar projection history; no corrective implementation required | `src/os/shell/taskbarPresentation.test.ts`, `taskbar.test.ts`, `shell.test.ts`, RTL lifecycle coverage | YES | YES | ALREADY GREEN |
| #87 | `issue-87-acceptance-map.md` | NO — current migration behavior already green | no intentional RED in r2 packet | `65ea002` Start System retirement; `4d9caf3` test coverage; later reconciliation commits are in release | `gate3.test.ts`, `startMenuSystemMigration.test.ts`, `runtimeOnlyInventory.test.ts` | YES | YES | ALREADY GREEN |
| #91 | `luna-b-r2-runway.md` | YES | `.red/issue-91.red.test.ts`; refreshed RED staged against `61fac771`; re-run at `56752dc` has 2 ordinary-cap failures and 1 safety-truncation pass | none; #174 Search projection work does not distinguish ordinary caps from safety truncation | none beyond existing cap test, which does not prove the distinction | NO | NO | RED NOT YET CONSUMED |
| #109 | `issue-109` characterization/acceptance materials | NO — shared presentation is already green | characterization only; no corrective RED | merged PR #150, merge `978c48b` | `src/os/visual/visual.components.test.tsx`, `visual.test.ts`, Shell pin/persistence tests | YES | YES | ALREADY GREEN |
| #111 | `issue-111-acceptance-map.md` | NO — no truthful deterministic corrective RED | characterization/current Visual tests; broad appearance review is not a fake source-shape RED | #190 visual foundation is in r2 (`8554633` and related history); #201 remains a separate cleanup/manual-review owner | Visual component tests plus Shell/refactor guards; packaged/manual appearance remains #201-owned | YES for accepted deterministic contract | YES for #190; #201 follow-up is not merged | ALREADY GREEN |
| #117 | `issue-117-acceptance-map.md` | YES, consumed | `.red/issue-117.red.test.ts`; original gate staged against `e815c463`; old copy still fails at `56752dc` if it reconstructs before the durable flush boundary | #214 merge `4a21881`; replay `b5b077e` | `src/os/windowing/placement.test.ts` plus `test/issue-117-window-placement.test.ts`; successor explicitly awaits `windowPlacement.flush()` | YES — 4 placement assertions and integration test pass | YES | GREEN IN R2 |
| #118 | `issue-118-acceptance-map.md` | YES, consumed | `.red/issue-118.red.test.ts`; original gate staged against `e815c463`; re-run at `56752dc` now passes | merged PR #237, merge `f3eb5f5`; grouping/member work includes `da4006b`, `9bb02ad`, `6117d21`, and later #198 reconciliation | `src/os/shell/taskbar.test.ts`, `taskbarMember.test.ts`, `taskbarPresentation.test.ts`, plus packaged group/context acceptance | YES — focused group tests pass | YES | GREEN IN R2 |
| #119 | `issue-119-acceptance-map.md`; `issue-119.characterization.test.tsx` | NO — no native transient consumer exists | characterization only; no corrective RED | none; explicitly deferred until a concrete native transient owner is selected | `src/native-apps/text/documentClose.test.ts` and app-local prompt tests | YES for current app-local prompt semantics | YES for existing behavior; no transient contract claimed | DEFERRED |

## Genuine RED handoffs

### #63 — next executable Issue

- **Packet:** `apps/plasmon/test/tdd/luna-b-r2-runway.md` and `issue-63-browser-adoption.md`
- **RED:** `apps/plasmon/test/tdd/.red/issue-63.red.ui.test.tsx`
- **Base reproduced:** original staging `e815c46358f20b25fd5b15f6409adefa19dfcad3`; independently re-run against current release `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`
- **Failure:** Alt-Tab does not move focus from the current native window to the prior Windowing MRU member, and no accessible Window switcher appears while Alt is held.
- **PRESERVE:** `WindowManager.focusSnapshot()` / MRU is the sole focus history; minimized/closed exclusion and Process focus authority.
- **CHANGE:** Shell keyboard adapter and accessible transient switcher must consume Windowing MRU without creating a second history.
- **UNSPECIFIED:** visual styling, animation, exact switcher placement, and any command vocabulary beyond accepted switch/commit/cancel behavior.
- **Lowest truthful layer:** RTL for keyboard/event delivery and accessible switcher; headless Windowing tests remain the state-machine authority.
- **Browser boundary:** real packaged keyboard focus and modifier delivery require the documented browser adoption path.
- **HARNESS GAP:** none for the current RED; packaged focus delivery remains unexecuted browser evidence, not a harness gap.
- **Permanent adoption:** promote the two behavioral failures into permanent Alt-Tab model/RTL coverage and add packaged keyboard/focus proof before closing.

### #91 — subsequent executable Issue

- **Packet:** `apps/plasmon/test/tdd/luna-b-r2-runway.md`
- **RED:** `apps/plasmon/test/tdd/.red/issue-91.red.test.ts`
- **Base reproduced:** refreshed staging `61fac7716975d011bc05588f5fc6fcdbf335fa35`; independently re-run against release `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`
- **Failure:** ordinary category/total result caps set `truncated: true`, conflating presentation bounds with incomplete/safety-limited traversal; the genuine traversal-safety case remains correctly detectable.
- **PRESERVE:** category/total bounds, deterministic result ordering, latest-query cancellation, and genuine traversal safety signaling.
- **CHANGE:** distinguish ordinary presentation limiting from incomplete filesystem traversal in the canonical Search result model and warning projection.
- **UNSPECIFIED:** field naming and UI copy, provided the structured distinction is explicit and Shell warning is driven only by genuine safety/incompleteness.
- **Lowest truthful layer:** Bun headless Search model.
- **Browser boundary:** only required later if warning presentation changes; no browser proof is needed for the model RED.
- **HARNESS GAP:** none.
- **Permanent adoption:** promote the model assertions into `src/os/shell/search.test.ts`/the canonical Search model successor; retain a regression proving ordinary caps do not warn and traversal safety does.

## Additional non-queue B packet spot-checks

These were prepared by this lane but are not among the 9 queue rows:

- **#88:** historical RED `f989d43` (base `2ce7cbe`) is subsumed by `runtimeOnlyInventory.test.ts`; current release passes 4 tests / 35 assertions. `tdd/88-red` is safe for later deletion.
- **#176:** refreshed RED `.red/issue-176.red.ui.test.tsx` against current release `56752dc` has 1 editable-boundary failure and 1 passing foreign-boundary characterization (the taskbar locator now uses the current `Taskbar context menu` name). The implementation branch `origin/agent/issue-176-context-menu-boundary` (`34ce4bb`) passes its four-test permanent RTL successor, but no merge into r2 was found. Status: **CLAIMED / IN PROGRESS**, not GREEN IN R2. Packet: `issue-176-acceptance-map.md`.
- **#177:** current release contains the promoted bounded first-free placement regression (`defaultPlacement.test.ts`); implementation history includes `61c1614`. Status: **GREEN IN R2**.
- **#183:** current release contains taskbar Close/alignment and packaged review-demo acceptance (`test/e2e/plasmon-review-demo.spec.ts`), merged via `4add918`. Status: **GREEN IN R2**, subject to browser-lane execution evidence.
- **#198:** merged via `e228fbe`; `taskbar.test.ts`, `taskbarMember.test.ts`, and `taskbarPresentation.test.ts` are green. Status: **GREEN IN R2**.
- **#199:** merged via `dd11c18`; Windowing geometry/interaction and packaged refactor-smoke paths are present. Status: **GREEN IN R2** for the promoted deterministic/browser regression paths.

## Current status

- **Total Lane-B queue entries:** 9
- **GREEN IN R2:** #117, #118; integrated accepted behavior for #72/#87/#109/#111
- **GREEN IN OPEN PR:** none verified by PR metadata
- **RED NOT YET CONSUMED:** #63, #91
- **CLAIMED / IN PROGRESS:** non-queue #176 implementation branch only
- **ALREADY GREEN / CHARACTERIZATION:** #61, #72, #87, #109, #111
- **HARNESS GAP / DEFERRED:** #119 deferred; no Lane-B harness gap
- **Current exact release SHA audited:** `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`
- **Current Issue being worked:** promotion audit and #63 handoff
- **Next executable Issue:** #63 Alt-Tab; #91 follows after #63 ownership is accepted

No queue item was silently marked complete from packet existence alone. The two genuine REDs remain flagged until permanent green regressions are promoted into the release.
