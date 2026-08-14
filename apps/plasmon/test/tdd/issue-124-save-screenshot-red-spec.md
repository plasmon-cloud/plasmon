# #124 game save screenshot RED/specification

**Disposition: HARNESS GAP / WAIT FOR DEPENDENCY.** #64 remains blocked on the
actual js-dos save/export/import capability and has no accepted authoritative,
NodeId-stable game-save artifact. The current headless composition cannot
express an explicit successful save boundary or inspect a preview attached to
that save without inventing the missing runtime seam. Desired vocabulary: a
runtime save result carrying stable save identity plus an optional bounded
preview capture outcome, with independent FsService inspection for save and
preview state.

After #64's contract, Bun proves metadata/persistence and failure isolation;
installed browser proves real canvas capture and cleanup. Do not create a
screenshot service, save library, second database, or make preview bytes
correctness-critical. No speculative RED is staged.
