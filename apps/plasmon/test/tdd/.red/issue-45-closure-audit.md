# Issue #45 — Recycle Bin surface closure audit

Disposition: **ALREADY GREEN for deterministic core; packaged/browser proof
pending**.

## Evidence basis

- Integrated release inspected: `origin/release/0.1.0-r2` at
  `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
- Implementation is integrated (`17ef2c1`, native Recycle Bin surface); no open
  implementation PR owns #45.
- Production authorities are `TrashService`/`FilesystemTrashService` for Trash
  semantics and `native-apps/recycle-bin/{model,index,RecycleBin.tsx}` for the
  native projection. The UI does not parse or mutate `/System/.Trash`.

## Criterion audit

| Requirement | Evidence | Disposition |
|---|---|---|
| first-class native registration/bootstrap | `model.test.ts`: registration, `/System/RecycleBin.sys`, and launch | proven |
| list canonical Trash entries | `RecycleBinModel.list()` delegates to `trash.list()` | proven |
| restore, collision/fallback, NodeId | model delegates to `trash.restore()`; filesystem lifecycle tests cover stable identity and collision | proven at deterministic layer |
| permanent delete and empty | model tests cover selected delete and empty | proven |
| confirmation-gated destructive UI actions | `RecycleBin.tsx` confirmation callbacks guard both actions | code-inspected; UI RTL/browser execution not present |
| external invalidation/refresh | model invalidation test and component subscription to `FsEventSource` | proven model; component wiring code-inspected |
| no duplicate Trash storage/schema | README and imports show the filesystem facade is the sole model dependency | proven by source inspection |
| packaged launch/render through real Shell/process/window path | no matching local Neutron session journal | browser boundary pending |

## Executed deterministic evidence

```text
bun test apps/plasmon/src/native-apps/recycle-bin/model.test.ts \
  apps/plasmon/test/trashLifecycle.test.ts \
  apps/plasmon/test/fileManagerDelete.test.ts
```

Result: **8 passed, 0 failed, 73 expect() calls**.

This proves the production model/filesystem composition in the canonical headless
environment. It does not prove packaged browser launch/render.

## Browser boundary

The remaining acceptance is a narrow packaged proof: launch Recycle Bin through
the real Desktop/system-app projection and process/window path, assert the
accessible `Recycle Bin` surface renders, and exercise only the confirmation
boundary if the fixture supplies a trashed item. Browser execution is currently
blocked because this worktree lacks
`local.ndeploy.session.json`; a Playwright list/parse result would not count as
execution. Do not reinstall or create a second fleet merely to close this gap.

## Ownership handoff

Luna-A owns this filesystem-facing closure audit and the authority boundary.
Native-app packaged/browser execution remains a cross-lane/D testing promotion
item; no competing implementation packet is created here.
