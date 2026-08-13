# Explorer

Explorer is the native application wrapper around the shared FileManager UI. It owns window-level filesystem navigation and view chrome while file operations and entry interaction remain in `os/file-manager/**`.

`history.ts` and `navigation.ts` provide the production navigation model. History is transient per Explorer instance and keyed by stable filesystem `NodeId`; paths are refreshed from `FsService` when a location is revisited. Folder activation, favorites, breadcrumbs, direct address navigation, and Up all enter the same push history. Back/Forward move the history cursor only after the filesystem proves the historical target still resolves to a directory; deleted or otherwise unreachable historical entries are discarded while searching for the next valid location. Re-navigating to the current `NodeId` refreshes its path without adding a duplicate entry.

`ExplorerApp.tsx` is the browser adapter for Back/Forward/Up, breadcrumbs/address entry, favorites, current-folder filtering, view/sort controls, the persisted `Show hidden files` presentation toggle, status, and the shared FileManager. Up is intentionally distinct from Back: it navigates to the current directory's filesystem parent as a new history entry, matching normal desktop File Explorer behavior.

The hidden-files toggle changes only FileManager presentation. Its durable value is stored by the FileManager preference store through `FsService`, and the FileManager visibility facade asks the canonical filesystem list contract whether hidden entries should be included. Explorer does not classify hidden resources itself. Address/navigation continues through the underlying filesystem service, so an explicitly navigated hidden directory remains addressable regardless of whether hidden children are currently shown.

Explorer does not implement a second filesystem, file-operation stack, association registry, hidden-resource policy, or browser-local preference store. Generic resource activation remains delegated through FileManager's canonical filesystem opening seam; Explorer's directory callback contributes only same-window navigation presentation.

## Refactor direction

Keep FileManager responsible for common entry/file actions and keep Explorer-specific code focused on navigation/view state. As Explorer grows, extract navigation/favorites/view-state controllers below React instead of turning `ExplorerApp.tsx` into a second FileManager implementation.

## Testing

Use fast tests for history/address/navigation and other deterministic view models, including Back/Forward ordering, Up, direct/folder navigation, no-op deduplication, stable-identity rename/move behavior, unreachable historical targets, FileManager-backed visibility preference persistence, and directory presentation. Use real-browser tests only for address-bar focus/keyboard behavior, the actual navigation toolbar adapter, layout/view controls, and packaged opening flows that depend on the rendered window.
