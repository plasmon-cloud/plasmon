# Issue #115 — command-layer readiness

Disposition: **CHARACTERIZATION READY / IMPLEMENTATION REQUIRED**.

## Evidence

Existing Bun/RTL and cross-surface tests prove the externally visible command
outcomes for opening, Properties/Open With, Delete/Trash, clipboard, shortcut
creation and activation. They do **not** prove that #115's bounded shared
production command seam exists or that multiple real consumers use each
retained command.

No structural RED is fabricated: source-shape assertions and arbitrary module
names would be invalid architecture gates.

## Required implementation acceptance

The implementation owner must audit duplicated Desktop/FileManager/Shell actions,
select only commands with at least two real consumers, and expose a small
production command/capability outcome seam that delegates to FsService,
TrashService, OpenDispatcher, AssociationRegistry/Open With, shortcut and
resource-policy authorities. Keyboard, toolbar/menu and context-menu consumers
must share that seam for every retained command. No god `ResourceService`, new
filesystem authority, or speculative generic framework.

## Existing lower-layer fence

The current tests remain characterization protection for canonical outcomes. Once
an actual command seam is integrated, add focused production-backed tests proving
capability/error equivalence across its two real consumers and update this packet
from characterization-ready to implementation evidence.
