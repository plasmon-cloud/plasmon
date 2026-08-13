# Issue #108 closure audit

Refresh: integrated release `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
No active PR owns #108. Classification: **VERIFIED CORE GREEN / INCOMPLETE
ACCEPTANCE**.

| Criterion | Permanent core evidence | Adapter/browser evidence | Result |
|---|---|---|---|
| Back returns previous valid location | `src/native-apps/explorer/navigation.test.ts` A→B→C Back | toolbar adapter in `ExplorerApp.tsx`; no packaged click proof found | core green / browser gap |
| Forward restores after Back | navigation test | disabled/enabled button wiring source inspected | core green / browser gap |
| Up is distinct new navigation | navigation test explicitly asserts Back returns to C | toolbar source | core green / browser gap |
| direct address and folder activation share history | navigation test | address input and FileManager callback source | core green / browser gap |
| no-op navigation deduplicates | navigation test | source adapter | core green |
| renamed/moved NodeId remains stable | navigation test resolves refreshed path | packaged browser not required for identity | green |
| deleted/unreachable history fails safely | navigation test prunes unreachable entries | visible toolbar error/disabled behavior not packaged-tested | core green / incomplete browser |
| visible Back button reaches production model | `ExplorerApp.tsx` uses `navigation.back()` | no executed packaged browser test | acceptance gap |

## Permanent GREEN destinations

- `apps/plasmon/src/native-apps/explorer/navigation.test.ts`
- `apps/plasmon/src/os/file-manager/file-manager.test.ts`
- Explorer production `ExplorerApp.tsx` toolbar adapter
- `apps/plasmon/src/native-apps/explorer/README.md` authority contract

No deterministic RED should be manufactured: all model criteria are already
covered. The remaining criterion is a genuine packaged/browser adapter check and
should be promoted to a focused Playwright test by the relevant future/testing
lane. Local session absence means **BROWSER BLOCKED / SPEC ONLY**, not a product
failure.
