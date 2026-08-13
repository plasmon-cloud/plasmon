# #64 js-dos progress persistence packet

**Disposition: VERIFIED FULL RED PACKET; exact engine API/browser remainder.**

Authority is the runtime host reading the selected game bytes through FsService
and persisting a runtime-specific changes artifact through FsService keyed by
stable source NodeId. The artifact is not browser IndexedDB/OPFS authority and
not a filesystem snapshot database.

Required observable journey: open legal `.jsdos`; make a representative change
through the real player; close cleanly; assert a bounded save artifact exists;
reopen after process/window reconstruction and restore; rename/move source and
prove stable identity still finds the artifact; failed capture must preserve the
source and report an error. Normal association/OpenService and no `.sys` wrapper
remain invariant.

The deterministic RED is executable at `.red/issue-64.red.test.ts`: the current
runtime definition exposes no Plasmon-authoritative save/restore bridge. Bun can
prove artifact identity/state transitions once that production seam exists.
Installed Playwright is required for actual js-dos `fsChanges` emission and
restore. Current host explicitly sets `autoSave: false`; #124 waits for the
accepted artifact shape. No implementation is included in this packet.
