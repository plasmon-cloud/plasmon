# Issue #172 closure audit — refreshed after #192 integration

Date: 2026-08-13
Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`

PR #205/#192 is integrated. The prior audit identified the missing composed
Trash/Desktop proof; this revision stages that proof but local execution remains
on the pre-#192 TDD composition and therefore fails before release integration.

## Acceptance matrix

| #172 criterion | Classification | Evidence |
|---|---|---|
| Restore to an unoccupied prior slot preserves original coordinates | PROVEN BY #192 | integrated pure layout/controller tests |
| Restore to occupied slot does not overlap existing icon | PROVEN BY #192; composed gate NOT YET PROVEN | integrated controller tests; composed test is staged but browser/session is not involved and exact integrated source was not run in this worktree |
| Restored resource gets deterministic free placement | PROVEN BY #192; composed gate NOT YET PROVEN | integrated deterministic scan tests; composed test awaits exact integrated-head execution |
| Unrelated positioned icons do not move | PROVEN BY #192; composed gate NOT YET PROVEN | integrated incumbent/stationary tests; real Trash composition still needs exact integrated run |
| Stable NodeId/Trash restore behavior remains unchanged | OUTSIDE #192 | existing `desktopCore.test.ts`/Trash lifecycle cover it; composed gate adds cross-authority evidence but is not independently green here |
| Pure layout plus smallest composed Desktop/Trash regression | NOT YET PROVEN | pure #192 evidence is integrated; `issue-172.composed.red.test.ts` is staged and reaches real Trash/placement on this lane but intentionally fails against pre-#192 layout |

## Executable gate

`apps/plasmon/test/tdd/.red/issue-172.composed.red.test.ts` uses the real
headless Plasmon filesystem, real `FilesystemTrashService`, real NodeId-backed
resources and the Desktop placement helper. It trashes a real Desktop node,
creates a real incumbent at its old position, restores the original NodeId,
reconciles and asserts incumbent stability/non-overlap/idempotence.

The gate reaches the intended collision assertion and fails because this TDD
worktree still has the pre-#192 allocator; that is not evidence against the
integrated release. Coordinator/implementation validation must run this exact
gate against the integrated #192 source before closing #172. Trash semantics
remain outside layout authority.
