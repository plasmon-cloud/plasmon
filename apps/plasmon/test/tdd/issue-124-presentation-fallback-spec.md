# #124 presentation fallback specification

Shared resource presentation receives optional preview metadata. Valid preview
renders with bounded contain sizing; absent, corrupt, stale, inaccessible or
unsupported preview renders canonical save/game fallback. Desktop/FileManager/
Search do not parse runtime save payloads or implement separate screenshot logic.
This waits for #64 save identity and #190 presentation seam.
