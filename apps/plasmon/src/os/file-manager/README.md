# Plasmon FileManager / Desktop Wave 2

This subsystem is the reusable browser-local filesystem presentation layer for Plasmon.

## Invariants

- `FileManager` renders only data returned by `FsService`; it does not own a second file database.
- Selection, desktop layout, drag groups, rename targets, and history identity use immutable `NodeId` values. Paths and names are presentation.
- Directory refreshes are generation-gated so an older asynchronous list cannot overwrite a newer one.
- `FsEventSource` is used only as invalidation; the current directory is re-read from `FsService`.
- File operation clipboard state is an explicit `FileOperationClipboard` instance. It is never the system text clipboard and never a module-global singleton.
- Copy/paste delegates to `fs.copy`; cut/paste delegates to `fs.move`; delete delegates to `fs.remove`; rename delegates to `fs.rename`; New Folder delegates to `fs.mkdir`.
- File open delegates to the Wave 1 `OpenWithServiceModel` / `AssociationRegistry` / `OpenService`. React code does not reproduce extension/MIME/Atom precedence.
- Directory open is a FileManager/Explorer navigation concern. Desktop may request `native:explorer` through the existing `ProcessController`.
- Desktop is exactly a FileManager rooted at `/Desktop`. Missing `/Desktop` is created by resolving `/` and calling `fs.mkdir`.
- Desktop coordinates are persisted in `/Desktop` metadata under `plasmon.desktop.positions.v1`, keyed by NodeId and written only on completed drag.
- No Share or Copy Share Link command is exposed in Wave 2.
- Native Explorer and Properties export metadata plus loader factories; they never instantiate a process/window/application registry.

## Interaction model

The shared FileManager implements click/Ctrl-or-Cmd/Shift selection, keyboard focus, select all, marquee selection, a movement threshold before pointer drag, selected-group transforms throttled through `requestAnimationFrame`, directory drops, inline rename, New Folder, cut/copy/paste/delete, context menus, Properties, and Open With.

Explorer adds NodeId-based back/forward history, parent navigation, breadcrumbs/address entry, current-directory filtering, favorites, grid/list/details presentations, sort controls, and a status bar while reusing the same FileManager.

Properties re-inspects `FsService` state and associations on refresh/event invalidation and exposes current name/type/extension/default handler/Atom identity/location/path/size/timestamps/content hash.
