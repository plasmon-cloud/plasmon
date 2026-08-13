# Desktop recomposition corpus

This corpus separates already-proven pure layout from missing Desktop/FileManager
composition evidence. NodeId is the identity key throughout.

| Scenario | Expected invariant | Existing evidence | Remaining evidence/owner |
|---|---|---|---|
| empty Desktop | no entries/no position writes | FileManager empty tests | composed Desktop mount if needed; #195 |
| one resource | deterministic valid slot | `layout.test.ts`, #192 tests | integrated composition |
| many resources | unique deterministic slots | layout tests | viewport/browser only if geometry claim |
| persisted positions | exact valid positions retained | Desktop parse/persist tests | recompose packaged state |
| new resource | existing positions fixed; new resource gets free slot | allocator tests | Desktop FsEvent composition |
| removed resource | removed NodeId no longer rendered; incumbents fixed | allocator active-ID logic | composed refresh |
| Trash restore | original NodeId returns | Trash/refactor guards | #172 composed collision/free-slot gate |
| occupied restored position | occupant fixed; restored gets free deterministic slot | #172 test intended RED on stale lane | integrated #192 execution |
| viewport shrinks | positions remain reachable according to accepted controller | #192 geometry tests | browser only for actual DOM workspace |
| viewport expands | no unnecessary movement of existing icons | controller/layout tests | integrated composition |
| rename | NodeId/position stable, label changes | refactor guards/rename tests | composed Desktop rename |
| path changed by move | NodeId/position semantics follow accepted Desktop policy | NodeId move tests | Desktop move composition |
| mixed shortcut/folder/file/app | common presentation and identity; no policy fork | FileManager/Visual/refactor guards | #190/#191 integration |

Do not duplicate #192 deterministic layout tests. Missing evidence belongs to
composition/adapter boundaries or #172 closure, not a new placement algorithm.
