# Issue #92 — drag-move operation preservation contract

Refresh: `origin/release/0.1.0-r2` =
`8cfb4d68414b271303bd0afefdcac9dc8449c315`. PR #208/#65, #195/#196, and
#223/#92 are integrated. Status: **GREEN IN R2 — RED CONSUMED**.

## PRESERVE

- `directoryDropTargetId` remains the canonical eligibility guard.
- `moveNodesToDirectory`/FsService owns actual move semantics and stable NodeId.
- selected source order and partial mutation semantics remain truthful.
- Desktop reposition remains separate from directory move.
- Drag preview/layering remains #66; context ownership remains #176.
- No byte progress or cancellation is claimed without FsService support.

## CHANGE required by #92

- represent a multi-item drag move using the accepted FileManager operation
  authority, extending it only where the actual drag workflow requires;
- expose running/completed/failed state and truthful processed/total/current item;
- preserve partial success and failure details;
- prevent duplicate submission of one active operation;
- add minimal accessible status in FileManager.

## UNSPECIFIED

- controller/component names;
- generic job manager;
- byte counts, ETA, cancellation, or background persistence;
- a second operation model.

## Current evidence

Integrated #65 exports `FileOperationState` with kinds `import | paste`, status
`idle | running | completed | failed`, item counters, current item, failures,
and duplicate `begin` protection. FileManager wires it to import and paste, but
The merged #195 `use-file-manager-pointer-adapter.ts` now starts the shared
`move` operation state and reports ordered move progress through the accepted
operation presentation.

The executable RTL RED therefore asserts only the truthful visible contract:
a delayed real `FsService.move` after a multi-item directory drop must expose an
accessible running status. It does not name a guessed `move` kind, invent byte
progress, or duplicate #65 state policy. The gate is intentionally expected to
fail on current integrated production.
