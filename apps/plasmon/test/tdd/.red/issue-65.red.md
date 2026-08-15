# Issue #65 — repaired packet

Disposition: **GREEN IN R2 — RED CONSUMED**.

PR #208 merged at `2b6984e96647eae1f3abe5719d3a3782809ceeb9`; recovery PR #232
merged at `aebb255bb0605f945258d581acab96d1f905b4b0`. The permanent RTL
regression is `apps/plasmon/test/rtl/issue-65-operation-progress.test.tsx`.

## Promoted gate

The former `issue-65.red.ui.test.tsx` uses the real headless Plasmon services
and real FileManager adapter. It covers:

- two-file import, item total, current item/name, completion and deterministic
  status cleanup;
- partial import failure with successful item retained, actionable alert and
  failed item absent;
- a conflicting second import trigger while the first operation is running;
- paste through the same accepted operation vocabulary (`Pasting N item(s)…`)
  with no fabricated byte progress.

The former first-test RED was consumed by the merged operation-state
implementation; current release execution passes the import and paste journeys.
No production operation API is fabricated by the packet.

## Vocabulary fence

The accepted future seam is the small item-level operation vocabulary described
by Issue #65: import/paste kind, running/completed/failed status, known total and
processed counts, current import item where truthful, partial failures, duplicate
start protection, and deterministic cleanup. #92 must reuse that seam if #65 is
accepted; it must not create a second progress model.

Filesystem write/copy semantics, collision naming, identity and rollback remain
FsService/helper authority. React only renders observed production state.
