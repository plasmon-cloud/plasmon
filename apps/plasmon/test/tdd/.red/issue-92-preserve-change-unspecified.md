# Issue #92 — drag-move operation preservation contract

Refresh: `origin/release/0.1.0-r2` = `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
PR #208/#65 is active implementation ownership and is not consumed. #92 has no
active implementation owner. Status: **WAIT FOR DEPENDENCY**.

## PRESERVE

- `directoryDropTargetId` remains the canonical eligibility guard.
- `moveNodesToDirectory`/FsService owns actual move semantics and stable NodeId.
- selected source order and partial mutation semantics remain truthful.
- Desktop reposition remains separate from directory move.
- Drag preview/layering remains #66; context ownership remains #176.
- No byte progress or cancellation is claimed without FsService support.

## CHANGE after #65 integrates

- represent a multi-item drag move using the accepted #65 operation vocabulary;
- expose running/completed/failed state and truthful processed/total/current item;
- preserve partial success and failure details;
- prevent duplicate submission of one active operation;
- add minimal accessible status in FileManager.

## UNSPECIFIED

- controller/component names;
- generic job manager;
- byte counts, ETA, cancellation, or background persistence;
- a second operation model.

## Stop condition

Do not stage executable RED until #65 is an ancestor of the integrated release,
its permanent `FileOperationState` vocabulary is inspected, and no new owner
claims #92. If the #65 merge leaves a promotion gap, record it as dependency risk
rather than repairing #65 from Luna-A.
