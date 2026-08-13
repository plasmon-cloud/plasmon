# #124 browser canvas specification

At a supported runtime save boundary, use the real canvas API only after runtime
readiness; assert capture dimensions/format bounds, local filesystem persistence
of preview, and cleanup on close. Force capture failure/taint where the browser
can honestly represent it and prove authoritative save still restores. Do not
assert every runtime supports capture, use a fake canvas as packaged proof, or
make preview bytes part of game-state correctness.
