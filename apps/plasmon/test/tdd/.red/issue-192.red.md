# Issue #192 promotion packet — Desktop placement controller

Disposition: **GREEN IN R2 — RED CONSUMED**. PR #205 merged at
`51cd761c207573a59197d53c9e2884335f2e7cc7`; current release is
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`. The former RED tests are retained
as permanent placement regression coverage.

This staging packet protects deterministic Desktop placement without changing
filesystem or Trash authority. It deliberately does not prescribe a React
component, storage schema, or exact visual grid implementation.

## Starting state

Current active Desktop path:

```text
PlasmonOS -> Desktop -> FileManager(presentation="desktop")
          -> desktop/layout.ts allocation
          -> Desktop metadata: plasmon.desktop.positions.v1
```

`Desktop.tsx` reads and persists the metadata on `/Desktop`; `FileManager.tsx`
computes render positions with `allocateDesktopPositions()` and applies drag
updates through `repositionDesktopNodes()`. The current allocator preserves any
finite stored point for an active NodeId, allocates only missing IDs, and does
not validate workspace bounds or reconcile duplicate points.

The filesystem `NodeId` is already the identity carried by positions. The
filesystem does not own visual placement, and `TrashService` owns restore and
original-location metadata.

## Authority map

| Concern | Authority | Consumer/adapter |
|---|---|---|
| node identity/existence, rename/move | filesystem core / `FsService` | Desktop/FileManager |
| Trash, restore, original parent/name metadata | `TrashService` | FileManager/Recycle Bin |
| visual Desktop position metadata and placement policy | Desktop placement seam (target) | Desktop/FileManager renderer |
| pointer/browser drag input | React/browser adapter | placement seam |
| rendered `left`/`top` | React adapter consuming resolved positions | `FileEntry` |

## Existing guard inventory

- `src/os/desktop/layout.test.ts`: current drag-from-allocated-slot
  characterization.
- `src/os/file-manager/file-manager.test.ts`: NodeId-keyed persisted position
  survives rename; `RefreshGate` prevents stale recomposition writes.
- `src/os/file-manager/polish.test.tsx`: new entries receive distinct free
  positions and valid persisted positions remain stable across recomposition.
- `src/os/fs/desktopCore.test.ts`: Trash restore preserves stable identity and
  handles filesystem name collisions; this is not Desktop visual placement.
- `test/refactorGuards.test.ts`: composed NodeId lifecycle and persistence.
- `test/rtl/renderPlasmon.test.tsx` and merged #187 packaged smoke: assembled
  Desktop/FileManager wiring and tolerant browser reachability.

These existing tests remain PRESERVE characterization; they do not assert
placement reconciliation for duplicate or invalid stored coordinates.

## Classification

### PRESERVE

- `NodeId` remains the placement key; rename and move do not create a new
  placement identity.
- Existing valid explicit user positions remain stable across refresh,
  recomposition, and filesystem reconstruction.
- Deterministic first placement remains stable for a given ordered resource
  set.
- Unrelated valid entries are not shifted merely because another entry is
  added, restored, renamed, or repaired.
- Filesystem existence/identity remains outside placement policy.
- Trash restore remains the source of original location/name metadata.
- React adapts pointer movement and renders resolved positions; it does not
  become a second persistence or filesystem authority.

### CHANGE / intentional RED

- A new or restored NodeId must not remain in a visibly occupied slot when a
  free valid slot exists.
- Duplicate/conflicting active positions require deterministic repair while
  retaining the first/unrelated valid owner.
- Invalid stored coordinates must be repaired into the usable workspace.
- Placement must be stable after repair across refresh/recomposition, including
  the #172 restore-to-Desktop collision.
- Resize/recomposition must use one bounded deterministic placement policy
  rather than preserving coordinates that are no longer usable.

### UNSPECIFIED

- Exact grid origin, row/column spacing, tile pixel dimensions, and ordering
  beyond the existing deterministic ordering contract.
- Icon artwork, label typography, rename geometry, and broad drag redesign.
- General native-window placement.
- Filesystem schema or Trash metadata changes.

## New intentional RED gates

`issue-192.red.test.ts` contains three focused Bun failures:

1. duplicate persisted slots leave the existing owner stable and allocate the
   restored/new resource elsewhere;
2. negative persisted coordinates are repaired into the usable workspace;
3. the #172 collision preserves an unrelated valid position while relocating
   the restored resource.

The failures are expected to reach the placement assertions. They must not be
reinterpreted as filesystem restore failures or solved by changing Trash
metadata.

## Lowest truthful layer

Pure Bun is sufficient for allocation, identity, occupancy, validation,
repair, deterministic ordering, resize, and recomposition. A future narrow
RTL/browser adapter check may verify that rendered `FileEntry` `left`/`top`
values consume controller output, but it must not duplicate the policy in a
browser test. No browser gate is staged in this packet because current
production lacks a separate controller observation seam and the deterministic
failures already identify the product defect.

## Implementor adoption

Adopt the RED test and move the smallest deterministic policy into one
production Desktop placement/controller seam. The seam should accept stable
NodeId-keyed entries plus usable workspace geometry, preserve valid explicit
positions, deterministically repair conflicts/out-of-bounds entries, and
return resolved positions for React to render and persist. Delete or bypass
obsolete allocation/repair logic after cutover; do not add `Desktop2` or a
parallel placement database. Keep the existing filesystem/Trash lifecycle
and all listed characterization guards green.

## Commands

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-192.red.test.ts
bun test apps/plasmon/src/os/desktop apps/plasmon/src/os/file-manager/file-manager.test.ts
npm --workspace neutron-plasmon test
```

The focused RED command is expected to fail only at the three placement
assertions. The existing Desktop/FileManager tests and the Plasmon fast suite
must remain green before handoff.
