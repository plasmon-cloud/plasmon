# Issue #95 — dedicated selected-label browser packet

Disposition: **BROWSER SPEC ONLY / EXECUTION BLOCKED**.

#95 is independent of #191. #191 bounds the inline rename editor inside the
FileEntry tile; #95 permits a selected/focused long filename to expand in a
readable overlay beyond the compact icon footprint.

## Executable gate

`test/e2e/plasmon-desktop-label-95.red.spec.ts` uses the real packaged Desktop
and asserts:

- unselected long label remains compact/ellipsized;
- selected label expands substantially beyond the icon entry width;
- neighboring entry geometry and the selected icon footprint do not move;
- expanded label is contained at the workspace edge and is pointer-transparent;
- the expanded label exercises sibling overlap and browser hit-testing above the
  sibling without an asserted z-index number;
- moving the selected entry to the right edge preserves bounded label geometry;
- F2 still opens a separately bounded rename editor, proving #95 and #191 can
  both hold without conflating their surfaces.

The local run is blocked before package boot by the missing PocketIC session
JSON; this is not product RED. No persisted coordinate or collision policy is
changed by this packet.
