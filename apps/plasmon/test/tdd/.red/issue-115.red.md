# Issue #115 — shared thin resource-command layer

## Disposition

**CHARACTERIZATION-ONLY / ALREADY GREEN EXTERNAL BEHAVIOR.** The current branch
already protects canonical externally visible outcomes, but no truthful RED can
be created for the requested convergence without asserting source shape or
inventing a generic command API. This packet records the authority map for an
implementor and deliberately does not freeze architecture.

## Canonical authorities and consumers

- Open/activation: `FilesystemOpenDispatcher` via `activation.ts`; FileManager,
  Shell/Start/Search, Desktop, and native app launch adapters consume it.
- Open With/defaults: `AssociationRegistry` and `OpenWithServiceModel`; Properties
  and FileManager dialogs consume it.
- Rename: `FsService.rename` through `renameNode`; FileManager and Properties.
- Trash/delete: `TrashService`/protected filesystem authority through `delete.ts`;
  FileManager, Desktop, Recycle Bin surfaces.
- Shortcut creation: `fs/shortcut.ts` + resource capabilities; FileManager and
  managed seed/bootstrap consumers.
- Copy/cut/paste: `FileOperationClipboard`, `pasteClipboardCollisionAware`,
  and FsService copy/move; FileManager keyboard, toolbar, and context menu.
- Download/import/create: FileManager bounded adapters over FsService.
- Move/drop: `moveNodesToDirectory` and Desktop placement controller (#192).
- Presentation/classification: #189/#190 seams, not a command layer.

## Preserve

Filesystem identity, policy, open/association/Trash/shortcut authorities, and
accessible command outcomes. A future thin layer should only compose actions
with at least two real consumers, expose enablement/error results, and delegate
rather than reimplement.

## Existing guards

FileManager model/gate tests, activation, delete/Trash, shortcut, clipboard,
Properties/Open With, cross-surface open, and RTL assembled tests cover the
external behavior. Keep these as characterization during any later bounded
migration; do not add component-count/module-count/line-count assertions.
