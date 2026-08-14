# Issue #78 — shortcut lifecycle audit

Refresh: `origin/release/0.1.0-r2` at
`82f176a6f11a163197a270a6c2275dde0f95a2e9`.

Disposition: **COMPLETE / NO IMPLEMENTATION REQUIRED**.

No open PR owns #78. #31/#44/#51 are integrated and their accepted production
seams are consumed by the lifecycle characterization.

## Integrated authorities

- Shortcut serialization, collision naming, and stable node target identity:
  `src/os/fs/shortcut.ts`.
- FileManager Create Shortcut command seam:
  `src/os/file-manager/create-shortcut.ts`.
- Canonical activation/dereference:
  `src/os/fs/openDispatcher.ts` through `activateFileManagerNode` and the
  Start/Search filesystem activation adapters.
- Filesystem identity and rename/move/Trash persistence: `FsService` and
  `TrashService`; consumers do not resolve shortcuts by visible path.

## Existing green evidence

Executed against the exact integrated release in the clean detached worktree
`/tmp/plasmon-r2-current`:

```text
bun test /tmp/plasmon-r2-current/apps/plasmon/src/os/file-manager/create-shortcut.test.tsx \
  /tmp/plasmon-r2-current/apps/plasmon/test/fileManagerActivation.test.ts \
  /tmp/plasmon-r2-current/apps/plasmon/test/resourceOpenCrossSurface.test.ts \
  /tmp/plasmon-r2-current/apps/plasmon/test/refactorGuards.test.ts
```

Result: **11 passed, 0 failed, 165 expect() calls**.

These tests prove canonical creation, collision naming, NodeId metadata,
rename/move target stability, FileManager activation, and matching FileManager/
Start/Search opening outcomes. Existing dispatcher tests also prove loop and
Recycle Bin-target rejection.

## Final lifecycle evidence

`issue-78.lifecycle.test.ts` adds one production-graph composition: Create
Shortcut and Send to Desktop create canonical NodeId targets; the target is
renamed/moved; FileManager, Start, and Search-backed activation all reach the
same target; and a removed target fails deterministically.

Executed against the exact integrated release:

```text
bun test /tmp/plasmon-runway/apps/plasmon/test/tdd/.red/issue-78.lifecycle.test.ts
```

Result: **1 passed, 0 failed, 8 expect() calls**.

The existing 11-test core evidence remains permanent. No browser dependency,
second shortcut format, path-based dereference, or duplicate lifecycle store is
introduced.
