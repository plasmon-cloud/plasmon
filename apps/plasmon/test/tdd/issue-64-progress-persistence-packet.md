# #64 js-dos progress persistence packet

**Disposition: BLOCKED — missing product/runtime seam; exact engine API and browser remainder.**

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

The current host exposes no truthful save/restore vocabulary and the shipped
expanded js-dos bundle/API is not present for deterministic invocation in this
checkout. The canonical headless composition therefore cannot express the
required engine mutation/save/restore journey. Do not invent an adapter-shaped
RED or guess method signatures. Desired vocabulary: an authorized runtime save
handle/export/import capability at an explicit save boundary, with the selected
source NodeId and FsService artifact inspection. Bun can prove artifact
identity/state transitions once that production seam exists.
Installed Playwright is required for actual js-dos `fsChanges` emission and
restore. Current host explicitly sets `autoSave: false`; #124 waits for the
accepted artifact shape. No implementation is included in this packet.
