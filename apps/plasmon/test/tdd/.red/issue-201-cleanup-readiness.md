# Issue #201 candidate-retirement inventory

Audit only. No candidate is deleted by Luna-A. Classification is based on
current TDD staging branch, not unmerged implementation branches.

| Candidate | Evidence | Classification |
|---|---|---|
| `FileManager.tsx` inline selection/rename/context/drag/render orchestration | active production consumer and broad adapter | STILL CONSUMED; wait for #195 |
| `FileEntry.tsx` local presentation/type mapping | active FileEntry consumer; shared Visual already used but local semantic labels remain | WAIT FOR #191 / #190 |
| `FileEntry` desktop expanded-label CSS | active selected/focused Desktop behavior and #95/#191 geometry | STILL CONSUMED; wait for #191 acceptance |
| `FileManager` Desktop placement adapter compatibility | current branch calls layout helpers; PR #205 has unmerged replacement | WAIT FOR #192 |
| `Desktop.tsx` local placement/reposition helper export | active current consumer; PR #205 moves policy | WAIT FOR #192 |
| `resourcePolicy.ts` semantic classification | active canonical semantic authority | STILL CONSUMED; wait for #189 only for richer type seam |
| `search.ts` MIME/media/category tables | active Search consumer; current duplicated inference | WAIT FOR #189 |
| `photos/media.ts` extension MIME table | active Photos consumer; current explicit MIME precedence defect | WAIT FOR #178/#189 |
| `text/editorModel.ts` extension language table | active Text consumer; #189 PR has replacement path but unmerged | WAIT FOR #178/#189 |
| `Shell.tsx` Search JSX/state/effects | active result surface | WAIT FOR #193 |
| `Shell.tsx` Start JSX/reconciliation lifecycle | active Start surface | WAIT FOR #169/#194 |
| `ExplorerApp.tsx` hard-coded Favorites path list | active projection, includes Downloads | WAIT FOR #182/#194 |
| `.fm-entry__thumbnail` legacy cover selector | search current CSS/source and verify no active runtime consumer before removal | UNKNOWN; do not delete based on selector name |
| local `ShellIcon`/taskbar fallback mapping | active Shell icon consumer, some state-specific policy | WAIT FOR #190/#193/#194 |
| Visual shared primitives/assets | active shared authority | STILL CONSUMED |
| `/static/plasmon/icons` browser-health allowances | active temporary acceptance annotation for package defect | WAIT FOR #190; remove only after installed URL fix |
| `Visual2`/`FileManager2`/`SearchPanel2` names | no such permanent path found in current branch | PROVEN SUPERSEDED / NOT PRESENT |
| stale `allocateDesktopPositions` compatibility wrapper | active tests/adapters on current branch; may be retained temporarily after #192 | WAIT FOR #192 |
| duplicate Neutron icon compatibility resolver | current bridge/resolver is active and tested | STILL CONSUMED; #171 owns future retirement only after supported consumers migrate |

## Retirement rules

Delete only after zero supported consumers, accepted replacement evidence, and
focused tests remain. Do not use line-count, file-count, or arbitrary source
shape as proof. Candidate cleanup is downstream of #189/#190/#191/#192/#193/#194/
#195 and should not preempt those implementation owners.
