# FileManager failure-state matrix

Refresh: integrated `82f176a`. Existing retry/error behavior is recorded, not
expanded. No retries are invented by this matrix.

| Failure | Authority | Visible state | Action remains available? | Existing evidence | Canonical owner |
|---|---|---|---|---|---|
| list failure | FsService/RefreshGate | ErrorBanner with retry/dismiss | retry if existing Refresh contract | FileManager tests | #195 preservation |
| stale NodeId | FsService/NodeId | command/open error; refresh may reconcile | explicit refresh/retry | activation/delete tests | #195 |
| open failure | OpenService/dispatcher | ErrorBanner/action error | FileManager remains usable | `fileManagerActivation.test.ts` | #31/#195 |
| rename collision | FsService rename | inline rename error, editor remains | retry/cancel | rename tests | #195 |
| rename missing resource | FsService | inline error/refresh path | retry only user action | rename/model tests | #195 |
| paste partial failure | FsService/clipboard command | actionable partial error + successful nodes retained | explicit retry | integrated #65 packet, clipboard tests | #195 preservation |
| import partial failure | FsService/import helper | actionable failure list + successful imports | explicit retry | create-import tests/integrated #65 packet | #195 preservation |
| shortcut failure | FsService/shared primitive | ErrorBanner; no partial visible selection | retry | #44 audit/gate3 | #44/#195 |
| Trash failure | TrashService | delete error and refreshed source | explicit retry | delete/Trash tests | #40/#45/#195 |
| Properties target disappeared | FsService/Properties loader | dialog error/close | refresh/reopen | properties tests | #195 |
| Open With unavailable | AssociationRegistry/OpenService | disabled action/title or visible error | ordinary Open remains | open-with tests | #47/#195 |
| thumbnail load/decode failure | FsService/browser/Visual | generic type icon fallback | entry remains selectable | image thumbnail tests | #93/#94/#195 |
| drag invalid target | drop helper | no move/reposition; selection stable | normal interaction | drag/drop model tests | #195/#66 |
| Desktop persistence failure | FsService metadata | Desktop notice/error; positions remain session-active if current contract | retry/dismiss existing adapter | Desktop source/tests | #192/#195 |
| hidden preference save failure | FsService preference store | visible preference notice; session state remains per current contract | retry setting | preference tests | #110 |

All failures must preserve canonical identity and must not silently substitute a
new path, handler, or resource. Browser/package execution claims remain separate
from deterministic failure semantics.
