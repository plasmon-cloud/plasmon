# Issue #172 closure audit

Date: 2026-08-13
Upstream implementation reviewed: PR #205 (`work/refactor/192-desktop-placement-controller`), current tip `6479170`.

This is an audit only. It does not close #172 or modify PR #205.

| #172 acceptance criterion | Classification | Evidence / smallest missing gate |
|---|---|---|
| Restore to an unoccupied prior slot preserves original coordinates | **PROVEN BY #192** | PR #205 `apps/plasmon/src/os/desktop/layout.test.ts` valid explicit position/recomposition coverage and controller behavior. |
| Restore to an occupied slot does not overlap existing icon | **PROVEN BY #192** | `issue-192.test.ts` occupied persisted slot gate plus `layout.test.ts` restore collision coverage. |
| Restored resource receives deterministic free placement | **PROVEN BY #192** | Pure `reconcileDesktopPositions` allocation and repeated recomposition tests; implementation uses deterministic grid scan. |
| Unrelated positioned icons do not move | **PROVEN BY #192** | Incumbent-priority and stationary drag-collision tests preserve incumbent coordinates. |
| Stable NodeId/Trash restore behavior remains unchanged | **OUTSIDE #192** | #192 intentionally does not own Trash. Existing `desktopCore.test.ts`, Trash lifecycle, and refactor guards prove NodeId/Trash semantics. A composed restore-to-Desktop test would be the smallest additional evidence if closure requires one test crossing both authorities. |
| Deterministic layout/composition coverage proves the r1 case | **PROVEN BY #192** | PR #205 pure layout/controller tests and packaged `plasmon-desktop-placement-192.spec.ts` adapter gate cover resolved positions and browser rendering. |

## Audit conclusion

PR #205 fully proves the placement-specific criteria and preserves the existing
Trash/NodeId authority by keeping it out of the controller. Criterion 5 is not a
new #192 RED gap, but it remains an external closure dependency: acceptance
should retain the existing Trash/identity regression evidence or add one small
composed test that restores a real trashed Desktop node and feeds the resulting
NodeId/position into Desktop reconciliation.

Do not treat PR existence or a passing pure controller suite as proof that the
release branch has accepted #172; PR #205 remains open and is not integrated into
`release/0.1.0-r2` at audit time.
