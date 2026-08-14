# Luna-A r2 runway disposition

Refresh: integrated release `5a6c9bb3d46d536c60a41382d5e3754539753dcd`.

This is a staging/acceptance inventory only. No production source, active
implementation packet, branch, or PR was modified.

## READY PACKETS

- **#92:** RTL RED; `issue-92.red.md` and `issue-92.red.ui.test.tsx`;
  active implementation PR #223 owns the Issue.
- **#169:** Headless RED; `issue-169-final-packet.md` and
  `issue-169.red.test.ts`; active implementation PR #221 owns the Issue.
- **#193:** final Search reconstruction packet;
  `issue-193-final-packet.md`; active implementation PR #219 owns the Issue.
- **#195/#196:** integrated and green; retained packets are preservation
  fences, not pending implementation work.
- **#197:** Luna-A Shell/FileManager authority-input packet;
  `issue-197-luna-a-shell-input-packet.md` (Shell implementation remains
  Luna-B-owned).
- **#201:** final cleanup/deletion contract;
  `issue-201-final-cleanup-contract.md` (cleanup is migration-gated).

## BLOCKED

- **#194:** blocked by #169's current RED and active PR #221, plus the
  separate #175 Start geometry boundary.
- **#175 browser geometry:** packaged/browser acceptance remains operationally
  blocked by the missing local session journal; this is not a product RED.
- **#197 implementation:** blocked by Luna-B ownership and surface boundaries
  #176/#193/#194/#198; Luna-A supplied only the consumer authority packet.
- **#201 cleanup:** blocked until #193/#194/#197/#199/#200 migrations and
  #169 are accepted, with consumer/reachability proof.
## COMPLETE / NO IMPLEMENTATION REQUIRED

- **#44, #78, #82, #93, #108, #110, #115, #172, #174, #178, #189, #192,
  #191/#190/#51/#65/#173/#195/#196 integrated dependencies.**
- #78 now has composed current-head lifecycle evidence after #51 integration:
  Create Shortcut and Send to Desktop, rename/move, FileManager/Start/Search
  activation, and deterministic missing-target failure.
- #174's former Search duplicate RED passes against current integrated source.
- #82 managed-root composition and #172 Desktop/Trash placement contracts are
  green at their exact integrated seams.

## DEFERRED

- **#198/#199/#200:** Luna-B/C-owned taskbar/window/Monaco implementation
  responsibilities; Luna-A records only authority dependencies.
- **#64/#113/#123/#124:** Luna-C runtime/native-app/media responsibilities.
- **#25/#26:** legacy gui2/platform retirement requires cross-lane reachability
  ownership and is not safe for Luna-A deletion.

## NO IMPLEMENTATION REQUIRED

Already-green lower-layer behavior must remain protected by its permanent tests;
no architecture/source-shape RED is added solely because `FileManager.tsx` or
`Shell.tsx` is broad. See the final packets and
`r2-luna-a-desktop-filemanager-fs-inventory.md` for exact authority/test maps.
