# Luna-A r2 runway disposition

Refresh: integrated release `82f176a6f11a163197a270a6c2275dde0f95a2e9`.

This is a staging/acceptance inventory only. No production source, active
implementation packet, branch, or PR was modified.

## READY PACKETS

- **#92:** RTL RED; `issue-92.red.md` and `issue-92.red.ui.test.tsx`.
- **#169:** Headless RED; `issue-169-final-packet.md` and
  `issue-169.red.test.ts`.
- **#193:** final Search reconstruction packet;
  `issue-193-final-packet.md`.
- **#195:** final FileManager decomposition packet;
  `issue-195-final-packet.md` and `issue-195.red.test.ts`.
- **#196:** final view-strategy packet;
  `issue-196-final-packet.md` (blocked for implementation by #195).
- **#197:** Luna-A Shell/FileManager authority-input packet;
  `issue-197-luna-a-shell-input-packet.md` (Shell implementation remains
  Luna-B-owned).
- **#201:** final cleanup/deletion contract;
  `issue-201-final-cleanup-contract.md` (cleanup is migration-gated).

## BLOCKED

- **#194:** blocked by the exact #169 malformed-`Accessories` reconciliation
  RED and the separate #175 Start geometry boundary.
- **#196 implementation:** blocked by active #195 PR #213/cutover; #173 is
  integrated and its behavior is already mapped.
- **#197 implementation:** blocked by Luna-B ownership and surface boundaries
  #176/#193/#194/#198; Luna-A supplied only the consumer authority packet.
- **#201 cleanup:** blocked until #195/#193/#194/#196/#197/#199/#200 migrations
  and #169 are accepted, with consumer/reachability proof.
- **#175 browser geometry:** operational/browser acceptance remains separate;
  missing local session is not a product RED.

## COMPLETE / NO IMPLEMENTATION REQUIRED

- **#44, #78, #82, #93, #108, #110, #115, #172, #174, #178, #189, #192,
  #195 packet preparation, and #191/#190/#51/#65/#173 integrated dependencies.**
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
