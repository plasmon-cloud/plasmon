# Issue #194 Start readiness

Reviewed #194, #169, current `startMenu.ts`, `startMenuSystemMigration.test.ts`,
Shell composition, activation, presentation, and preference guards.

| Prerequisite | Status | Evidence / handoff |
|---|---|---|
| #169 deterministic Start reconciliation/controller | IMPLEMENTATION MISSING | current `reconcileStartMenu` is production-backed and tested, but reconciliation is still called from composition/lifecycle paths; no integrated #169 implementation was visible. |
| `/System/Start Menu` sole durable authority | READY | filesystem seeds, migration tests, activation and README explicitly preserve this boundary. |
| user customization/move/rename/delete | READY | `startMenuSystemMigration.test.ts`, runtime inventory tests and managed seed ledger tests. |
| #189 classification | PACKET EXISTS BUT NOT INTEGRATED | needed for shared app/resource labels; PR #207 remains open. |
| #190 presentation | PACKET EXISTS BUT NOT INTEGRATED | shared Visual consumers exist; packaged Plasmon asset root remains tracked RED. |
| Start navigation/launch/dismissal | READY characterization | Shell tests, activation tests, RTL/refactor smoke cover accepted semantics. |
| focused rendered Start surface | IMPLEMENTATION MISSING | Start JSX and lifecycle orchestration remain in `Shell.tsx`; #194 owns extraction. |
| explicit root/folder/loading/empty/error state model | SPEC GAP | current state is rendered inline; deterministic state vocabulary should be characterized before extraction. |
| browser geometry | BROWSER RED / SPEC GAP | stable Start panel geometry needs a focused #175-like browser gate; no exact pixels should be frozen without acceptance reference. |

## Ordering

#169 must establish the durable reconciliation/boot boundary before #194 cuts
React lifecycle over to a focused Start surface. #189/#190 are consumer
prerequisites but not reasons to move filesystem authority into Shell. Existing
activation and customization tests should remain the common refactor fence.
