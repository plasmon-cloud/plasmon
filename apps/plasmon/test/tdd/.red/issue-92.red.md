# Issue #92 — multi-item drag-move progress state

## Disposition

**RECONNAISSANCE COMPLETE — WAIT FOR #65 OPERATION-STATE ARCHITECTURE.** The
current drag path has a real missing visible operation state, but the canonical
Issue explicitly requires reuse of a suitable #65 primitive if one lands.
Staging a second operation model now would freeze competing architecture.

## Preserve / change

Preserve current selection identity, one validated directory drop, sequential
filesystem moves, partial-success semantics, and NodeIds. Change only the
visible truthful item-level running/completed/failed lifecycle, duplicate
submission protection, and accessible status presentation after #65's seam is
observable.

Do not claim byte progress or cancellation without filesystem contracts.

## Current evidence

`FileManager.tsx` awaits `moveNodesToDirectory()` after pointer release and
renders no operation status. `model.ts` validates the complete source set once
then moves each NodeId. Existing drag/drop tests cover the semantic outcome.

## Follow-up gate plan

After #65 implementation lands, add deterministic model/headless transitions
for success, partial failure, active-operation protection, and a narrow RTL
status journey. Reuse the accepted operation vocabulary; do not create a second
job manager. Browser coverage is optional for status visibility, not move
semantics.
