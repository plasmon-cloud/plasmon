# Issue #92 — accepted operation-model consumption plan

Status: **WAIT FOR DEPENDENCY**. The only observed #65 implementation is open PR
#208 (`work/file-manager/65-operation-progress`), so this plan intentionally
contains no import, cast, or future API name.

## Required post-integration inspection

1. Fetch `origin/release/0.1.0-r2` and verify #208 merge ancestry.
2. Locate the permanent #65 operation state type/store/controller and read its
   tests and FileManager integration.
3. Record exact accepted kinds/status/count/current-item/error vocabulary.
4. Confirm whether active operation identity and duplicate-trigger behavior are
   part of #65 or require #92-specific orchestration.
5. Check open PR ownership for #92 again.

## Consumption mapping

| #92 behavior | Accepted #65 evidence required | Expected test layer |
|---|---|---|
| drag move starts after drop | operation starts through accepted command seam | headless/RTL |
| truthful total/current | exact #65 item counters, no byte claims | headless |
| per-item success | accepted completed representation | headless |
| partial failure | accepted failure/error representation | headless + RTL |
| duplicate active move | accepted busy/operation identity guard | RTL/headless |
| drop validation | existing `directoryDropTargetId`/model tests | headless |
| NodeId preservation | real FsService move | headless |
| visible status | actual FileManager operation status semantics | RTL |

No RED file is staged until this table can name real production exports. A test
that imports a guessed `FileOperationState2`, casts a future controller, or copies
#65's policy into the fixture would be invalid.
