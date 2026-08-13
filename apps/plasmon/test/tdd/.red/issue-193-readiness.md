# Issue #193 readiness — refreshed after r2 integration

Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

This is a readiness audit, not Luna-B's Search implementation packet.

| Prerequisite / criterion | Status | Evidence and remaining work |
|---|---|---|
| Canonical native source composition | PACKET EXISTS BUT NOT INTEGRATED | #174 lower tests now cover hidden policy, identity and activation; current Search still assembles direct native results plus filesystem `.sys` results. |
| Visible result uniqueness | VERIFIED CORE RED / INCOMPLETE | #174 RED reaches `searchShell` and receives two Browser results. “No second app catalog” is not READY for visible projection uniqueness. |
| #189 classification | PACKET EXISTS BUT NOT INTEGRATED | PR #207 remains open; #178 waits for its accepted result seam. |
| #190 shared presentation/assets | BROWSER RED / PACKET EXISTS | deterministic Visual is green; installed Plasmon asset URL gate is repaired but browser-blocked without session. |
| #175 stable Search frame geometry | SPEC GAP / BROWSER RED | Search remains inline in `Shell.tsx`; no accepted stable-frame geometry gate was integrated. |
| typed query/category/loading/empty/error/result state | READY CHARACTERIZATION | `search.ts` typed result/state helpers and existing Shell/RTL tests cover behavior. |
| canonical activation | READY | activation and cross-surface tests delegate to filesystem/open authorities. |
| no parallel installation catalog | READY AUTHORITY FENCE, NOT PROJECTION ACCEPTANCE | registry, filesystem projections and Neutron discovery remain separate authorities; this does not excuse the duplicate visible results. |
| React isolation | IMPLEMENTATION MISSING | Search state/render remains in `Shell.tsx`; #193 owns extraction after source convergence. |
| keyboard/focus/dismissal | CHARACTERIZATION READY | existing RTL/refactor smoke covers semantic behavior; geometry remains separate. |
| packaged health | BROWSER BLOCKED | strict #187 baseline is available; local session JSON is absent in this worktree. |

## Correct dependency statement

The authoritative-source composition and visible-projection uniqueness are two
separate claims. The former is an architecture fence already protected by
existing source/composition tests; the latter is an active #174 RED and is not
READY. #193 must consume the accepted converged Search result model rather than
repairing duplicates locally or creating a second app catalog.
