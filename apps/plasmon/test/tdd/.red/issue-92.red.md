# Issue #92 — multi-item drag-move progress

Disposition: **TDD:RTL RED** against integrated release
`3399a87372973b732f57fc89b0e7fcfd922f64ab`.

## Authority inspection

- Drag orchestration: `apps/plasmon/src/os/file-manager/FileManager.tsx`
  `handleEntryPointerUp`.
- Drop validation and mutation: `model.ts::validateDirectoryDrop` and
  `moveNodesToDirectory`, delegating each mutation to `FsService.move`.
- Existing operation authority: `operation-state.ts::FileOperationState`,
  integrated by #65 for import and paste only (`FileOperationKind` is exactly
  `import | paste`).
- Presentation: FileManager's accessible `role="status"` operation message.

## PRESERVE / CHANGE / UNSPECIFIED

Preserve canonical `directoryDropTargetId`/drop validation, source order,
FsService move semantics, stable NodeIds, partial mutation truth, Desktop
reposition separation, #66 drag presentation, and no byte/cancellation claims.

Change the drag-originated multi-item directory move to expose a truthful
running/completed/failed item lifecycle and accessible status, reusing the
accepted operation-state authority rather than creating a competing model.

Unspecified are API names, byte counts, ETA, cancellation, persistence, generic
job management, and exact visual copy beyond truthful accessible status.

## Executed RED gate

```text
bun test --preload /tmp/plasmon-r2-current/apps/plasmon/test/setupHappyDom.ts \
  /tmp/plasmon-r2-current/apps/plasmon/test/tdd/.red/issue-92.red.ui.test.tsx
```

Result: **intentional failure**: after a delayed real `FsService.move` starts,
`queryByRole("status")` is `null`. This fails for the intended missing drag
operation lifecycle, not setup absence or a swallowed error. The gate ran
against the exact integrated release in a clean detached worktree because the
long-lived Luna branch predates #65.

The existing lower-layer drop validation and NodeId move semantics remain green;
this packet does not weaken or replace those tests. No browser/package test is
needed for the deterministic accessible-status boundary.
