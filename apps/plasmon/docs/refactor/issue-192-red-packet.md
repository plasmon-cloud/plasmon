# Issue #192 RED packet — Desktop placement controller

This packet is adopted from Luna TDD-A commit `e56b246` as normal Issue-branch refactor evidence. It protects deterministic Desktop placement without changing filesystem or Trash authority.

## Starting state

Current active Desktop path at the r2 base:

```text
PlasmonOS -> Desktop -> FileManager(presentation="desktop")
          -> desktop/layout.ts allocation
          -> Desktop metadata: plasmon.desktop.positions.v1
```

`Desktop.tsx` reads and persists the metadata on `/Desktop`; `FileManager.tsx` computes render positions with `allocateDesktopPositions()` and applies drag updates through `repositionDesktopNodes()`. The starting allocator preserves any finite stored point for an active NodeId, allocates only missing IDs, and does not validate workspace bounds or reconcile duplicate points.

The filesystem `NodeId` is already the identity carried by positions. The filesystem does not own visual placement, and `TrashService` owns restore and original-location metadata.

## Authority map

| Concern | Authority | Consumer/adapter |
|---|---|---|
| node identity/existence, rename/move | filesystem core / `FsService` | Desktop/FileManager |
| Trash, restore, original parent/name metadata | `TrashService` | FileManager/Recycle Bin |
| visual Desktop position metadata and placement policy | Desktop placement seam (target) | Desktop/FileManager renderer |
| pointer/browser drag input | React/browser adapter | placement seam |
| rendered `left`/`top` | React adapter consuming resolved positions | `FileEntry` |

## Existing guard inventory

- `src/os/desktop/layout.test.ts`: current drag-from-allocated-slot characterization.
- `src/os/file-manager/file-manager.test.ts`: NodeId-keyed persisted position survives rename; `RefreshGate` prevents stale recomposition writes.
- `src/os/file-manager/polish.test.tsx`: new entries receive distinct free positions and valid persisted positions remain stable across recomposition.
- `src/os/fs/desktopCore.test.ts`: Trash restore preserves stable identity and handles filesystem name collisions; this is not Desktop visual placement.
- `test/refactorGuards.test.ts`: composed NodeId lifecycle and persistence.
- `test/rtl/renderPlasmon.test.tsx` and merged #187 packaged smoke: assembled Desktop/FileManager wiring and tolerant browser reachability.

These existing tests remain PRESERVE characterization; they do not assert placement reconciliation for duplicate or invalid stored coordinates.

## Classification

### PRESERVE

- `NodeId` remains the placement key; rename and move do not create a new placement identity.
- Existing valid explicit user positions remain stable across refresh, recomposition, and filesystem reconstruction.
- Deterministic first placement remains stable for a given ordered resource set.
- Unrelated valid entries are not shifted merely because another entry is added, restored, renamed, or repaired.
- Filesystem existence/identity remains outside placement policy.
- Trash restore remains the source of original location/name metadata.
- React adapts pointer movement and renders resolved positions; it does not become a second persistence or filesystem authority.

### CHANGE / intentional RED

- A new or restored NodeId must not remain in a visibly occupied slot when a free valid slot exists.
- Duplicate/conflicting active positions require deterministic repair while retaining the first/unrelated valid owner.
- Invalid stored coordinates must be repaired into the usable workspace.
- Placement must be stable after repair across refresh/recomposition, including the #172 restore-to-Desktop collision.
- Resize/recomposition must use one bounded deterministic placement policy rather than preserving coordinates that are no longer usable.

### UNSPECIFIED

- Exact grid origin, row/column spacing, tile pixel dimensions, and ordering beyond the existing deterministic ordering contract.
- Icon artwork, label typography, rename geometry, and broad drag redesign.
- General native-window placement.
- Filesystem schema or Trash metadata changes.

## New intentional RED gates

`src/os/desktop/issue-192.test.ts` contains three focused Bun failures:

1. duplicate persisted slots leave the existing owner stable and allocate the restored/new resource elsewhere;
2. negative persisted coordinates are repaired into the usable workspace;
3. the #172 collision preserves an unrelated valid position while relocating the restored resource.

The failures are expected to reach the placement assertions. They must not be reinterpreted as filesystem restore failures or solved by changing Trash metadata.

## Lowest truthful layer

Pure Bun is sufficient for allocation, identity, occupancy, validation, repair, deterministic ordering, resize, and recomposition. A narrow rendered/browser adapter check may verify that rendered `FileEntry` `left`/`top` values consume controller output, but it must not duplicate policy in a browser test.

## Implementor adoption

The production seam must remain narrow:

```text
NodeId + usable workspace geometry + persisted/occupied positions
  -> deterministic valid placement/reconciliation result
```

It must not absorb filesystem, Trash, resource-presentation, open/association, or drag/drop authority. React measures/adapts browser input and renders/applies controller output.

Delete or bypass obsolete allocation/repair logic after cutover; do not add `Desktop2` or a parallel placement database. Keep the existing filesystem/Trash lifecycle and all listed characterization guards green.
