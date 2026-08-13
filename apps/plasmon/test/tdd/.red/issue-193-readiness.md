# Issue #193 Search readiness

Reviewed canonical #193, #174, #175, #189, #190, #187, current `src/os/shell/search.ts`
and Search tests. This is a readiness audit, not Luna-B's full Search packet.

| Prerequisite | Status | Evidence / handoff |
|---|---|---|
| #174 native `.sys` single projection | PACKET EXISTS BUT NOT INTEGRATED | #174 headless RED exists; current `searchFilesystem` can emit system `.sys` as a file/document alongside native app result. |
| #189 canonical classification | PACKET EXISTS BUT NOT INTEGRATED | PR #207 is open, not on release; current branch has only semantic `classifyResource`, not full MIME/language result. |
| #190 shared presentation | PACKET EXISTS BUT NOT INTEGRATED | current Visual seam/tests exist; installed Plasmon asset root remains #190 RED. |
| #175 stable Search frame geometry | IMPLEMENTATION MISSING / SPEC GAP | Search panel remains rendered in `Shell.tsx`; no dedicated #175 packet was owned in this lane. Needs focused browser geometry gate. |
| Search result model/query/category/loading/error | READY | `search.ts` has typed result unions, limits, cancellation, warnings and category filtering. |
| canonical activation | READY | `activation.ts`, cross-surface and refactor guards delegate to filesystem/open authorities. |
| no second app catalog | READY | native registry + Neutron discovery + filesystem projections are composed in `searchShell`; projection de-duplication tests cover Neutron. |
| React isolation | IMPLEMENTATION MISSING | Search state/render remains coordinated by `Shell.tsx`; #193 owns extraction after source convergence. |
| keyboard/focus/dismissal | READY characterization | existing Shell/RTL/refactor smoke covers accepted semantic behavior; geometry is not goldenized. |
| package/browser health | BROWSER RED | #187 smoke has temporary `/static/plasmon/icons` allowances for #190 and operational session availability is separate. |

## Ordering

Land/accept #189 and #174 consumer convergence before final Search extraction;
#190 presentation migration may proceed in parallel but must expose the real
installed asset contract. #193 can characterize existing result state now, but
its final cutover should not freeze the known #175 geometry defect or duplicate
classification/projection policy.
