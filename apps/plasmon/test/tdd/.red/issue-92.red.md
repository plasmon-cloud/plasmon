# Issue #92 — multi-item drag-move progress

Disposition: **GREEN IN R2 — RED CONSUMED**.
PR #223 (`agent/feature-92-drag-move-progress`) merged at
`34e5daea6b59e66a7980a892df90a61729ffd7c5`. The original RED was reproduced
against the pre-#223 release; current release is
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.

## Authority inspection

- Drag orchestration: merged #195
  `apps/plasmon/src/os/file-manager/use-file-manager-pointer-adapter.ts`
  `handleEntryPointerUp`, now consuming the merged move operation state.
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

## Original RED and promoted regression

Original RED: the delayed real `FsService.move` path returned no accessible
`role="status"` while a multi-item move was running. PR #223 consumed that gate
and promoted it to ordinary production coverage:

- `apps/plasmon/test/rtl/issue-92.test.tsx` — running/completion,
  partial-failure, and duplicate-operation guards;
- `apps/plasmon/src/os/file-manager/move-operation.test.ts` — ordered partial
  mutation truth;
- `operation-state.test.ts` and `operation-presentation.test.ts` — permanent
  move vocabulary/presentation guards.

Current release focused execution: **3 #92 RTL tests passed**.
