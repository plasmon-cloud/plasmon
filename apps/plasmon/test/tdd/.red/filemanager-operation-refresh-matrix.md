# FileManager operation / refresh matrix

Purpose: durable refactor-safety map for command completion, FsEvent
reconciliation and selection/progress cleanup. This is not a second operation
manager and does not create an Issue by itself.

| Operation | Command authority | Running state | Completion observation | Fs event | Refresh gate | Selection reconciliation | Error/progress cleanup |
|---|---|---|---|---|---|---|---|
| import | FileManager import helper -> FsService create/write | currently opaque; #65 proposed item-level state | awaited writes and final result | created/changed/removed rollback | `RefreshGate` invalidates stale directory refresh | newly created IDs may be selected; failed rollback must not remain selected | partial success visible; clear only after final settled state |
| paste copy | `FileOperationClipboard` + collision-aware FsService copy | currently opaque; #65 | per-item copy result/final clipboard policy | created | refresh after all or per-item with generation protection | copied fresh NodeIds reconcile against visible set; source selection remains | active operation blocks duplicate paste; failures do not erase successful copies |
| cut/move paste | clipboard + FsService move | currently opaque; #65 | per-item move result | moved/removed | old and new parent refresh can race | remove moved IDs from source; target selection policy explicit | preserve clipboard only for partial failure if contract says so; never duplicate mutation |
| drag/drop move | `validateDirectoryDrop` + `moveNodesToDirectory` -> FsService move | waits after pointer release; #92 waits for #65 seam | per-item move/final partial result | moved/removed | source and target refreshes share generation discipline | selected group remains NodeId keyed; moved IDs reconcile in source/target | drag cleanup independent from operation cleanup; active duplicate gesture blocked |
| rename | FileManager rename command -> FsService rename | short awaited command, no progress needed | returned renamed node or error | changed | refresh may return old name; generation must reject stale result | preserve renamed NodeId and selection/focus | inline editor exits only on successful commit; error leaves edit state and message |
| shortcut creation | canonical shortcut primitive -> FsService create | short command; #51 destination consumer | created shortcut node | created | Desktop/Favorites refresh may observe asynchronously | source selection is not replaced unless contract says; new shortcut identity distinct | clear busy/error on settled create; no source mutation |
| delete | Trash authority -> move/remove | short/possibly multi-item | Trash result per item | moved/removed | source refresh and Recycle Bin invalidation | removed IDs reconciled; continue after protected failure | preserve canonical policy errors; no stale selection resurrection |
| restore | TrashService restore -> Desktop placement #192 | restore command completion | returned restored NodeId/metadata | moved/created/changed | Desktop placement reconciliation after visible event | restored ID becomes visible without displacing incumbent | collision repair is placement-owned, not Trash metadata mutation |
| hidden visibility toggle | filesystem-backed preference store + visibility wrapper | preference save awaited; listing refresh | saved root metadata and new list | usually no resource event; preference change is local | begin new refresh after visibility change | hidden IDs removed from selection; reappearing IDs do not gain stale selection unless policy says | save error remains visible; no localStorage fallback |
| external filesystem event | FsEvent source | none; event-driven | event payload/revision | any created/changed/moved/removed/reset | `RefreshGate` rejects older async list | `reconcileSelection` against latest visible IDs | errors surface without clearing newer successful snapshot |

## Race hotspots

1. An import/paste completion can arrive after an external event-triggered
   refresh; only the newest `RefreshGate` generation may publish nodes.
2. A moved item emits both source and target observations; selection must use
   stable NodeIds and not duplicate a node from stale snapshots.
3. Rename completion can be overwritten by a pre-rename list response; the
   accepted name is the FsService result, not local optimistic text.
4. Hidden-toggle refresh can resurrect selected dot-hidden IDs if selection is
   reconciled before the new visibility-filtered list is committed.
5. Restore must feed #192 placement after the node becomes visible; Trash does
   not own visual coordinates.
6. Progress cleanup must happen in `finally`/settled operation state and must not
   be tied only to one React component unmount.

## Existing protection

`RefreshGate`, `reconcileSelection`, FsService revision/event contracts,
clipboard model, Trash lifecycle, and #192 placement tests already protect
important lower-layer semantics. #65 is not integrated on the release branch,
so #92 remains WAIT FOR #65 and this matrix intentionally does not define a
new operation-state API.
