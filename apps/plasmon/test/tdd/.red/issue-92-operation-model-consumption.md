# Issue #92 — accepted operation-model consumption plan

Status: **RTL RED / ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH** against
integrated release `5a6c9bb3d46d536c60a41382d5e3754539753dcd`. PR #208/#65 and
#195/#196 are merged; PR #223 owns #92 implementation.

## Integrated #65 inspection

- #208 is an ancestor of the integrated release (`2b6984e` merge).
- The accepted authority is `operation-state.ts::FileOperationState`.
- Accepted kinds are exactly `import | paste`; statuses are exactly
  `idle | running | completed | failed`.
- It records total/processed/succeeded/failed item counts, current index/item,
  failure records, subscriptions, and rejects a second `begin` while running.
- The merged #195 pointer adapter wires this state to import and paste only.
- The drag-drop path still calls `moveNodesToDirectory(fs, source, target)`
  directly after pointer release, with no operation-state begin/current/final
  lifecycle.
- PR #223 (`agent/feature-92-drag-move-progress`) is open; Luna-A does not
  inspect or modify its implementation branch.

## Consumption mapping

| #92 behavior | Current authority/evidence | Layer/disposition |
|---|---|---|
| drag move starts after drop | `handleEntryPointerUp` -> `moveNodesToDirectory` | production path exists; no operation lifecycle — RTL RED |
| truthful total/current | source list is available; accepted state has counters but drag does not use them | RTL RED target; no byte claim |
| per-item success | `moveNodesToDirectory` loops `FsService.move` but returns only after completion | future headless/model seam required; not invented here |
| partial failure | current loop rejects on first thrown move and FileManager shows one error | future RED after accepted drag orchestration seam |
| duplicate active move | no drag-operation guard; `FileOperationState.begin` protects only import/paste | future RTL/headless criterion |
| drop validation | `validateDirectoryDrop` and `directoryDropTargetId` | existing headless tests green |
| NodeId preservation | real `FsService.move` | existing filesystem tests green |
| visible status | operation status renderer exists for import/paste only | current RTL RED |

`issue-92.red.ui.test.tsx` is the smallest truthful gate: it uses the real
headless service graph, delayed real `FsService.move`, actual pointer drag/drop,
and asserts accessible running status. It does not import a future operation
kind, cast an API, or reimplement #65 policy.
