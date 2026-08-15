# Issue #169 — final Start reconciliation packet

Disposition: **GREEN IN R2 — RED CONSUMED**.

PR #221 (`agent/fix-169-start-reconciliation`) merged at
`02a248e43342a7fc82a17ba19cab0ac471f9cbbb`. Current integrated release:
`origin/release/0.1.0-r2` at
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`. This packet remains the accepted
RED and permanent reconciliation-fence record.

## PRESERVE

- `/System/Start Menu` and its durable seed ledger remain the Start authority.
- `reconcileStartMenu`, `FsService`, stable NodeIds, shared shortcut metadata,
  conservative user customization/deletion policy, and Neutron/native identity
  remain authoritative.
- Existing managed defaults must be reused only when ownership is provable;
  renamed/moved/customized/deleted user resources must not be overwritten or
  resurrected.
- #82 managed-root/bootstrap behavior remains separate and must not be replaced
  by Start UI logic.

## CHANGE

Repair the ambiguous/malformed managed-folder collision path so an existing
`Accessories` sibling cannot reject the whole reconciliation and blank Start.
Preserve the sibling/resource, continue or surface a bounded per-entry outcome,
and keep subsequent reconciliation deterministic. The exact production recovery
API/message is unspecified; the observable invariant is no whole-surface blanking
from one ambiguous entry.

## UNSPECIFIED

Controller name, error/result shape, folder collision naming, UI component,
retry wording, and migration representation. Do not create a Start database,
filename-only ownership guess, or test-local reconciliation.

## Existing guards

- `src/os/shell/startMenuSystemMigration.test.ts` covers legacy System migration,
  stable NodeIds, customization/move/rename/delete preservation, and idempotence.
- `apps/plasmon/test/managedRootBootstrap.test.ts` covers production composition,
  Start Menu identity, user preservation, repeated reconciliation, and repair.
- `src/os/fs/desktopCore.test.ts`, activation tests, and refactor guards cover
  filesystem identity/opening and managed roots.

## Exact RED

`apps/plasmon/test/tdd/.red/issue-169.red.test.ts` creates a real malformed
`Accessories` file through the headless production graph, then calls the real
`reconcileStartMenu` with a native seed requiring Accessories.

Original RED was the malformed `Accessories` sibling rejection. PR #221
consumed it and promoted the permanent reconciliation tests. Current release
contains the corrected Start migration path; this historical RED must not be
re-run as a current product failure.

## Browser boundary / HARNESS GAP

No browser boundary is required for reconciliation semantics. Start rendered
navigation/focus/dismissal and geometry belong to #194/#175. No HARNESS GAP.

## Likely / forbidden areas

Likely: `src/os/shell/startMenu.ts`, focused deterministic tests, and narrowly
scoped Shell/Filesystem documentation.

Must not modify: FsService storage schema, Neutron installation authority,
Search authority, Trash, Process/Windowing, or create a parallel Start inventory.
