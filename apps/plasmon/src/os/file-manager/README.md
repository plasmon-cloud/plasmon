# FileManager

`file-manager/**` is the reusable filesystem presentation and interaction layer used by Desktop and Explorer-style applications. It renders authoritative `FsService` state and coordinates selection, rename, clipboard operations, drag/drop, create/import/download, context commands, Properties/Open With presentation, and error reporting.

## Architecture

Deterministic behavior already lives in production helper modules such as:

- `model.ts` — selection, marquee geometry, refresh gating, rename helpers, and file-operation state;
- `activation.ts` — the thin FileManager adapter to the canonical filesystem open authority, including caller-owned same-window directory navigation;
- `clipboard.ts` — collision-aware copy/cut/paste behavior;
- `create-import.ts`, `download.ts` — filesystem action helpers;
- `delete.ts` — the thin ordinary-Delete adapter to the canonical filesystem Trash authority, including deterministic multi-selection success/failure reporting;
- `keyboard.ts`, `drag.ts`, `drop-target.ts`, `rename.ts` — interaction decisions;
- `properties.tsx` — Properties/Open With presentation.

`FileManager.tsx` connects those models/actions to React state, DOM pointer/keyboard events, dialogs, and rendering.

FileManager is not a filesystem repository and must not grow private application-opening or Trash policy. All normal resource activation delegates to the filesystem core's canonical open dispatcher. FileManager may provide presentation-owned directory navigation so an existing Explorer window can navigate in place, but resource classification, shortcut dereference, system/Neutron application opening, and ordinary association dispatch remain filesystem/opening authority concerns.

Ordinary Delete delegates to the filesystem core's canonical Trash service. FileManager retains confirmation, selection reconciliation, and visible error presentation, while protection decisions, Trash metadata, stable-identity moves, restore, permanent deletion, and emptying remain filesystem authority concerns.

## Refactor direction

`FileManager.tsx` is a broad orchestration component. Continue extracting action availability/execution, async refresh coordination, context command models, and reusable interaction state into production modules where doing so makes behavior cheaper to test and shared by Desktop/Explorer.

Do not split by historical feature wave or create separate Desktop/Explorer operation stacks. Preserve one set of filesystem actions and capability-aware commands, with React responsible mainly for rendering and translating browser events.

## Testing

Use fast tests for selection/range/marquee math, clipboard/collision naming, refresh ordering, command eligibility, activation routing, rename/create/import/delete helpers, drag/drop decisions, and filesystem action outcomes. Cross-surface activation and ordinary-Delete tests should use the shared headless Plasmon environment so FileManager's production adapters exercise the real filesystem dispatcher/Trash authority, associations, process/window state, protection policy, and Neutron boundary.

Use real-browser tests for pointer capture/drag, keyboard routing/editable targets, file chooser/import, object-URL download behavior, focus/dialog/context-menu interaction, and packaged visible workflows.

When a UI bug is fundamentally a shared command/model bug, add the regression below React first instead of relying only on click-path coverage.
