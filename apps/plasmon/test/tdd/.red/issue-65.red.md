# Issue #65 — repaired packet

Disposition: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**.

## Executable gate

`issue-65.red.ui.test.tsx` now uses the real headless Plasmon services and real
FileManager adapter. It covers:

- two-file import, item total, current item/name, completion and deterministic
  status cleanup;
- partial import failure with successful item retained, actionable alert and
  failed item absent;
- a conflicting second import trigger while the first operation is running;
- paste through the same accepted operation vocabulary (`Pasting N item(s)…`)
  with no fabricated byte progress.

The first test's intentional RED occurs only after delayed real FsService writes
begin and the expected accessible status is missing. No production operation API
is fabricated by the packet.

## Vocabulary fence

The accepted future seam is the small item-level operation vocabulary described
by Issue #65: import/paste kind, running/completed/failed status, known total and
processed counts, current import item where truthful, partial failures, duplicate
start protection, and deterministic cleanup. #92 must reuse that seam if #65 is
accepted; it must not create a second progress model.

Filesystem write/copy semantics, collision naming, identity and rollback remain
FsService/helper authority. React only renders observed production state.
