# Desktop

`desktop/**` is the Plasmon Desktop presentation over filesystem state. `Desktop.tsx` reuses the shared FileManager interaction surface and persists desktop-specific visual placement metadata.

The Desktop is not a separate file database, application registry, Trash authority, resource-presentation authority, or launch authority. Filesystem contents come from `FsService`; Trash/restore semantics remain in `TrashService`; opening and file operations route through the shared OS services used by other filesystem surfaces.

## State and placement authority

Desktop placement is keyed by stable filesystem `NodeId` rather than path/name. That lets rename and filesystem movement preserve placement identity.

`layout.ts` contains the single deterministic Desktop placement/reconciliation policy. Its authority is deliberately narrow:

```text
NodeId + usable workspace geometry + persisted/occupied positions
  -> deterministic valid placement/reconciliation result
```

The controller:

- preserves valid explicit user positions;
- deterministically allocates the first free Desktop slot for missing/conflicting entries;
- repairs duplicate and out-of-workspace active positions;
- preserves already-visible incumbent NodeIds ahead of newly visible/restored NodeIds when resolving a collision, so filename/display ordering cannot displace an unrelated icon;
- ignores inactive persisted records as visible occupancy so a prior position may remain available for later restore reconciliation;
- recomposes deterministically when workspace geometry changes.

It does **not** inspect filesystem resource semantics, choose handlers, classify or render resources, perform Trash/restore operations, or own browser drag/drop commands. Incumbency is only prior visible `NodeId` state supplied to the placement policy; it is not Trash metadata or restore authority.

`Desktop.tsx` remains the persistence/composition adapter. It measures usable browser geometry, supplies stable active/incumbent NodeIds and persisted metadata to the controller, renders/persists the resolved result, and translates explicit drag deltas through the pure drag-input adapter. `FileManager` continues to own shared file interaction and browser pointer mechanics; it directly renders the authoritative positions supplied by Desktop and does not define or invoke a second placement algorithm.

## Refactor direction

Keep `Desktop.tsx` thin. When Desktop and FileManager diverge, prefer improving their shared presentation/model layer while keeping desktop-only concerns limited to workspace placement, background behavior, and desktop-specific interaction conventions.

Do not add another per-surface resource presentation resolver or semantic resource authority while working on placement. The #191 pilot established that deterministic policy extraction is useful only when it preserves and consumes canonical domain seams.

## Testing

Use Bun for placement allocation, collision repair, incumbent/new visibility ordering, bounds validation, resize/recomposition, NodeId stability, and explicit drag-position translation. Use real-browser tests only for claims requiring layout, such as proving rendered Desktop entries apply their authoritative `left`/`top` positions. Filesystem and Trash behavior remain protected at their existing authority layers.
