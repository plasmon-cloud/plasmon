# FileManager

`file-manager/**` is the reusable filesystem presentation and interaction layer used by Desktop and Explorer-style applications. It renders authoritative `FsService` state and coordinates selection, rename, clipboard operations, drag/drop, create/import/download, context commands, Properties/Open With presentation, visibility preferences, and error reporting.

## Architecture

Deterministic behavior already lives in production helper modules such as:

- `model.ts` — selection, marquee geometry, refresh gating, rename helpers, and file-operation state;
- `activation.ts` — the thin FileManager adapter to the canonical filesystem open authority, including caller-owned same-window directory navigation;
- `clipboard.ts` — collision-aware copy/cut/paste behavior;
- `create-import.ts`, `download.ts` — filesystem action helpers;
- `create-shortcut.ts` — capability-aware FileManager shortcut creation that delegates serialization, stable target identity, and collision naming to the canonical filesystem shortcut primitive;
- `delete.ts` — the thin ordinary-Delete adapter to the canonical filesystem Trash authority, including deterministic multi-selection success/failure reporting;
- `preferences.ts` — the small filesystem-backed FileManager presentation preference store;
- `visibility.ts` — the presentation-only filesystem view that selects the canonical `includeHidden` list mode without classifying resources itself;
- `file-entry-state.ts` — pure `NodeId`-keyed FileEntry render state, consuming Desktop controller coordinates while deriving rename/selection/focus presentation state;
- `use-file-entry-presentation.ts` — the React/browser lifecycle adapter around the shared FileManager resource-presentation resolver and image-thumbnail loader; it does not classify, open, or mutate resources;
- `keyboard.ts`, `drag.ts`, `drop-target.ts`, `rename.ts` — interaction decisions;
- `properties.tsx` — Properties/Open With presentation.

`FileManager.tsx` connects those models/actions to React state, DOM pointer/keyboard events, dialogs, and rendering. `FileEntry.tsx` is a rendered adapter: it consumes stable resource identity, derived render state, resolved shared presentation, and a Desktop position supplied by the placement authority, then translates user interaction back to FileManager's existing command/service paths.

FileManager is not a filesystem repository and must not grow private application-opening or Trash policy. All normal resource activation delegates to the filesystem core's canonical open dispatcher. FileManager may provide presentation-owned directory navigation so an existing Explorer window can navigate in place, but resource classification, shortcut dereference, system/Neutron application opening, and ordinary association dispatch remain filesystem/opening authority concerns.

Ordinary Delete delegates to the filesystem core's canonical Trash service. FileManager retains confirmation, selection reconciliation, and visible error presentation, while protection decisions, Trash metadata, stable-identity moves, restore, permanent deletion, and emptying remain filesystem authority concerns.

Create Shortcut eligibility follows canonical filesystem resource capabilities. The filesystem `createShortcut()` primitive owns shortcut metadata, unique-name allocation, and stable `NodeId` targets; FileManager owns command presentation and the created shortcut's selection, focus, inline rename, and visible error handling.

Hidden-resource classification also remains filesystem-owned. FileManager's `Show hidden files` preference stores only whether Explorer should request hidden entries, using namespaced metadata on the filesystem root through `FsService`. The visibility layer passes `includeHidden` to the canonical filesystem list contract and never reimplements hidden detection from filenames or metadata. Showing hidden entries changes presentation only and does not weaken resource protection.

Desktop selected/focused labels are pointer-independent overlays that may widen within the current workspace for readability without changing the underlying 92px icon footprint or its controller-owned position. Inline rename is separately bounded to that FileEntry tile. Neither state participates in neighboring Desktop placement or changes stable `NodeId` placement metadata.

## Refactor direction

`FileManager.tsx` is a broad orchestration component. Continue extracting action availability/execution, async refresh coordination, context command models, and reusable interaction state into production modules where doing so makes behavior cheaper to test and shared by Desktop/Explorer.

Do not split by historical feature wave or create separate Desktop/Explorer operation stacks. Preserve one set of filesystem actions and capability-aware commands, with React responsible mainly for rendering and translating browser events.

For later presentation refactors, prefer the same humble-adapter pattern only where a demonstrated deterministic policy can be extracted cleanly. Do not copy FileEntry-specific browser lifecycle hooks into parallel presentation authorities; shared resource identity/presentation convergence belongs in the canonical visual/presentation seams.

## Testing

Use fast tests for selection/range/marquee math, clipboard/collision naming, refresh ordering, command eligibility, activation routing, rename/create/import/delete helpers, drag/drop decisions, filesystem action outcomes, persisted view preferences, and pure FileEntry render-state derivation. Hidden-file presentation tests must exercise the filesystem list contract rather than duplicating hidden-name classification in FileManager tests. Cross-surface activation and ordinary-Delete tests should use the shared headless Plasmon environment so FileManager's production adapters exercise the real filesystem dispatcher/Trash authority, associations, process/window state, protection policy, and Neutron boundary.

Use real-browser tests for pointer capture/drag, keyboard routing/editable targets, file chooser/import, object-URL download behavior, focus/dialog/context-menu interaction, and packaged visible workflows. Desktop label/rename geometry that depends on actual CSS layout is protected by the focused packaged-browser FileEntry gate rather than a headless approximation.

When a UI bug is fundamentally a shared command/model bug, add the regression below React first instead of relying only on click-path coverage.
