# #64 js-dos progress persistence packet

**Disposition: VERIFIED CORE RED / INCOMPLETE ACCEPTANCE.**

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

Bun can prove artifact identity/state transitions once the production save seam
exists. Installed Playwright is required for actual js-dos `fsChanges` emission
and restore. Current host explicitly sets `autoSave: false` and has no
Plasmon-authoritative save bridge, so this is not GREEN. #124 must wait for the
accepted artifact shape. No implementation is included in this packet.
