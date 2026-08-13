# #124 game save screenshot RED/specification

**Disposition: WAIT FOR DEPENDENCY.** #64 must first define an authoritative,
NodeId-stable game save/changes artifact. A supported runtime may then capture a
bounded representative frame at an explicit save boundary and persist a
non-authoritative preview reference/bytes. Capture failure must never block or
corrupt the save; shared presentation supplies fallback.

Bun proves metadata/persistence and failure isolation. Installed browser proves
real canvas capture and cleanup. Do not create a screenshot service, save
library, second database, or make preview bytes correctness-critical. No RED is
staged while the save authority is unspecified.
