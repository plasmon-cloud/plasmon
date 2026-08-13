# Issue #172 closure audit — refreshed after #192 integration

Date: 2026-08-13
Integrated release: `51cd761c207573a59197d53c9e2884335f2e7cc7`

PR #205/#192 is now integrated. The previous audit correctly identified the
missing composed Trash/Desktop proof; this revision stages it.

## Acceptance matrix

| #172 criterion | Status | Evidence |
|---|---|---|
| Restore to an unoccupied prior slot preserves original coordinates | PROVEN BY #192 | integrated `layout.test.ts` valid explicit position/recomposition coverage |
| Restore to occupied slot does not overlap existing icon | PROVEN BY #192 + composed gate | integrated controller tests plus `issue-172.composed.red.test.ts` real Trash restore path |
| Restored resource gets deterministic free placement | PROVEN BY #192 + composed gate | repeated `allocateDesktopPositions` result is asserted stable |
| Unrelated positioned icons do not move | PROVEN BY #192 + composed gate | real occupant is snapshotted and its coordinates/FS node remain unchanged |
| Stable NodeId/Trash restore behavior remains unchanged | PROVEN BY existing Trash tests + composed gate | `desktopCore.test.ts`/Trash lifecycle plus real restore assertion preserves original NodeId |
| Pure layout plus smallest composed Desktop/Trash regression | PROVEN BY #192 + composed gate | integrated pure layout tests and `issue-172.composed.red.test.ts` |

## Executable gate

`apps/plasmon/test/tdd/.red/issue-172.composed.red.test.ts` uses the real
headless Plasmon filesystem, real `FilesystemTrashService`, real NodeId-backed
resources and the production Desktop placement helper. It trashes a real
Desktop node, creates a real incumbent at its old position, restores the original
NodeId, reconciles, asserts incumbent stability/non-overlap and checks
recomposition idempotence.

The gate is intentionally a RED staging gate against this lane's pre-#192
composition; when adopted onto the integrated release it exercises the accepted
controller. It does not move Trash semantics into layout and does not close #172
itself. The coordinator should rerun it on the exact integrated release head
before closing the Issue.
