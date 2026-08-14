# Issue #194 Start readiness

Reviewed #194, #169, current `startMenu.ts`, `startMenuSystemMigration.test.ts`,
Shell composition, activation, presentation, and preference guards.

| Prerequisite | Status | Evidence / handoff |
|---|---|---|
| #169 deterministic Start reconciliation/controller | HEADLESS RED / PREREQUISITE | current `reconcileStartMenu` is production-backed, but malformed Accessories sibling rejects reconciliation; see `issue-169-final-packet.md`. |
| `/System/Start Menu` sole durable authority | READY | filesystem seeds, migration tests, activation and README explicitly preserve this boundary. |
| user customization/move/rename/delete | READY | `startMenuSystemMigration.test.ts`, runtime inventory tests and managed seed ledger tests. |
| #189 classification | INTEGRATED | canonical classifier is available for shared app/resource labels. |
| #190 presentation | INTEGRATED | shared Visual/resource presentation is available; Start must consume it without local catalogs. |
| Start navigation/launch/dismissal | READY characterization | Shell tests, activation tests, RTL/refactor smoke cover accepted semantics. |
| focused rendered Start surface | IMPLEMENTATION MISSING | Start JSX and lifecycle orchestration remain in `Shell.tsx`; #194 owns extraction. |
| explicit root/folder/loading/empty/error state model | SPEC GAP | current state is rendered inline; deterministic state vocabulary should be characterized before extraction. |
| browser geometry | BROWSER RED / SPEC GAP | stable Start panel geometry needs a focused #175-like browser gate; no exact pixels should be frozen without acceptance reference. |

## Ordering

#169 must establish the durable reconciliation/boot boundary before #194 cuts
React lifecycle over to a focused Start surface. #189/#190 are integrated
consumer seams, not reasons to move filesystem authority into Shell. Existing
activation and customization tests remain the common refactor fence. The final
packet is blocked only by the exact #169 RED and eventual #175 geometry evidence.
