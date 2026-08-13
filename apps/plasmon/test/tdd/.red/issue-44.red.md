# Issue #44 — canonical Create Shortcut

## Disposition

**ALREADY GREEN.** This behavior is implemented on the current r2 base and is
covered by `src/os/file-manager/create-shortcut.test.tsx`, filesystem shortcut
and dispatcher tests, and FileManager command-surface assertions.

The tests prove canonical `plasmon.shortcut` v1 metadata, stable target NodeId,
collision-safe naming, independent shortcut rename/move, single-selection
eligibility, protected-target handling, and normal FileManager command exposure.
No duplicate RED gate is staged against merged behavior.

#51 remains separately responsible for the Desktop destination convenience
command; #44 does not imply Send to Desktop.
