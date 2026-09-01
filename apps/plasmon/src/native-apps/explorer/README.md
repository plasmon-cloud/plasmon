# File Explorer (`native:explorer`)

File Explorer is the user-facing native application around the shared FileManager UI. The established internal `ExplorerApp`/`native:explorer` identity owns window-level filesystem navigation and view chrome while file operations and entry interaction remain in `os/file-manager/**`.

`history.ts` and `navigation.ts` provide the production navigation model. History is transient per File Explorer instance and keyed by stable filesystem `NodeId`; paths are refreshed from `FsService` when a location is revisited. Folder activation, favorites, breadcrumbs, direct address navigation, and Up all enter the same push history. Back/Forward move the history cursor only after the filesystem proves the historical target still resolves to a directory; deleted or otherwise unreachable historical entries are discarded while searching for the next valid location. Re-navigating to the current `NodeId` refreshes its path without adding a duplicate entry.

`ExplorerApp.tsx` is the internal browser adapter for Back/Forward/Up, breadcrumbs/address entry, favorites, current-folder filtering, view/sort controls, the persisted `Show hidden files` presentation toggle, status, and the shared FileManager. Up is intentionally distinct from Back: it navigates to the current directory's filesystem parent as a new history entry, matching normal desktop File Explorer behavior.

`favorites.ts` defines the default Favorites inventory as a live `FsService` projection of top-level filesystem directories, preserving each resource's canonical `NodeId` rather than maintaining a second folder registry. Canonical `/Apps` is intentionally included when that filesystem directory exists; `/Downloads` and `/System` are intentionally excluded. An existing `/Downloads` tree remains ordinary filesystem data and is never deleted merely to change the default presentation. User-created top-level directories participate automatically, and File Explorer refreshes the projection only for filesystem events that can change root inventory. Favorite rows consume shared Visual resource/application presentation rather than maintaining a sidebar-specific icon taxonomy.

The hidden-files toggle changes only FileManager presentation. Its durable value is stored by the FileManager preference store through `FsService`, and the FileManager visibility facade asks the canonical filesystem list contract whether hidden entries should be included. File Explorer does not classify hidden resources itself. Address/navigation continues through the underlying filesystem service, so an explicitly navigated hidden directory remains addressable regardless of whether hidden children are currently shown.

The internal Explorer adapter does not implement a second filesystem, file-operation stack, association registry, hidden-resource policy, or browser-local preference store. Generic resource activation remains delegated through FileManager's canonical filesystem opening seam; its directory callback contributes only same-window navigation presentation.

## Refactor direction

Keep FileManager responsible for common entry/file actions and keep the internal Explorer adapter focused on navigation/view state. As it grows, extract navigation/favorites/view-state controllers below React instead of turning `ExplorerApp.tsx` into a second FileManager implementation.

## Testing

Use fast tests for history/address/navigation and other deterministic view models, including Back/Forward ordering, Up, direct/folder navigation, no-op deduplication, stable-identity rename/move behavior, unreachable historical targets, FileManager-backed visibility preference persistence, and directory presentation. Use real-browser tests only for address-bar focus/keyboard behavior, the actual navigation toolbar adapter, layout/view controls, and packaged opening flows that depend on the rendered window.
