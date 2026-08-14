# Issue #78 — shortcut lifecycle audit

Refresh: `origin/release/0.1.0-r2` at
`2b6984e96647eae1f3abe5719d3a3782809ceeb9`.

Disposition: **WAIT FOR DEPENDENCY — #51 active implementation ownership**.

No open PR owns #78. PR #210/#51 (`work/file-manager/51-send-to-desktop`) is
still open and must not be consumed as integrated source or modified by Luna-A.
Issue #78 explicitly relates the complete lifecycle to #31, #44, and #51; the
integrated release contains #31/#44 but not the accepted Send to Desktop
consumer from #51.

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
`/tmp/plasmon-r2-92`:

```text
bun test /tmp/plasmon-r2-92/apps/plasmon/src/os/file-manager/create-shortcut.test.tsx \
  /tmp/plasmon-r2-92/apps/plasmon/test/fileManagerActivation.test.ts \
  /tmp/plasmon-r2-92/apps/plasmon/test/resourceOpenCrossSurface.test.ts \
  /tmp/plasmon-r2-92/apps/plasmon/test/refactorGuards.test.ts
```

Result: **11 passed, 0 failed, 165 expect() calls**.

These tests prove canonical creation, collision naming, NodeId metadata,
rename/move target stability, FileManager activation, and matching FileManager/
Start/Search opening outcomes. Existing dispatcher tests also prove loop and
Recycle Bin-target rejection.

## Missing/deferred evidence

The release does not yet contain the #51 Send to Desktop production command.
Therefore the complete #78 lifecycle acceptance cannot be called ALREADY GREEN
and no replacement test should invent that consumer's future API. Once #51 is
integrated and ownership is free, add one real headless composition extending
existing evidence to create through Send to Desktop, rename/move the target,
activate through the legitimate FileManager and Shell-backed surfaces, and
assert deterministic missing-target failure. Do not duplicate shortcut policy
or create a second lifecycle store.

This is a dependency wait, not a browser boundary and not a product RED against
integrated release. The existing green tests must remain the permanent core
destination; the future gate should cover only the unproven #51 consumer link.
