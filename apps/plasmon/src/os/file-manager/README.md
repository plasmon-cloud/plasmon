# FileManager

`file-manager/**` is the reusable filesystem presentation and interaction layer used by Desktop and Explorer-style applications. It renders authoritative `FsService` state and coordinates selection, rename, clipboard operations, drag/drop, create/import/download, context commands, Properties/Open With presentation, visibility preferences, operation status, and error reporting.

## Architecture

Deterministic behavior already lives in production helper modules such as:

- `model.ts` — selection, marquee geometry, refresh gating, rename helpers, and clipboard state;
- `operation-state.ts` — the small injectable FileManager operation lifecycle vocabulary for import/paste status, item counts, current import item, partial import failures, and duplicate-start protection;
- `activation.ts` — the thin FileManager adapter to the canonical filesystem open authority, including caller-owned same-window directory navigation;
- `clipboard.ts` — collision-aware copy/cut/paste behavior;
- `create-import.ts`, `download.ts` — filesystem action helpers;
- `create-shortcut.ts` — capability-aware FileManager shortcut creation that delegates serialization, stable target identity, and collision naming to the canonical filesystem shortcut primitive;
- `delete.ts` — the thin ordinary-Delete adapter to the canonical filesystem Trash authority, including deterministic multi-selection success/failure reporting;
- `preferences.ts` — the small filesystem-backed FileManager presentation preference store;
- `visibility.ts` — the presentation-only filesystem view that selects the canonical `includeHidden` list mode without classifying resources itself;
- `keyboard.ts`, `drag.ts`, `drop-target.ts`, `rename.ts` — interaction decisions;
- `properties.tsx` — Properties/Open With presentation.

`FileManager.tsx` connects those models/actions to React state, DOM pointer/keyboard events, dialogs, and rendering. Import can truthfully expose per-item progress because FileManager already sequences those items. Paste exposes running/completed/failed lifecycle and the known total count, but does not invent byte or per-item progress that the existing filesystem paste boundary does not report.

FileManager is not a filesystem repository and must not grow private application-opening or Trash policy. All normal resource activation delegates to the filesystem core's canonical open dispatcher. FileManager may provide presentation-owned directory navigation so an existing Explorer window can navigate in place, but resource classification, shortcut dereference, system/Neutron application opening, and ordinary association dispatch remain filesystem/opening authority concerns.

Ordinary Delete delegates to the filesystem core's canonical Trash service. FileManager retains confirmation, selection reconciliation, and visible error presentation, while protection decisions, Trash metadata, stable-identity moves, restore, permanent deletion, and emptying remain filesystem authority concerns.

Create Shortcut eligibility follows canonical filesystem resource capabilities. The filesystem `createShortcut()` primitive owns shortcut metadata, unique-name allocation, and stable `NodeId` targets; FileManager owns command presentation and the created shortcut's selection, focus, inline rename, and visible error handling.

Hidden-resource classification also remains filesystem-owned. FileManager's `Show hidden files` preference stores only whether Explorer should request hidden entries, using namespaced metadata on the filesystem root through `FsService`. The visibility layer passes `includeHidden` to the canonical filesystem list contract and never reimplements hidden detection from filenames or metadata. Showing hidden entries changes presentation only and does not weaken resource protection.

### Resource presentation boundary

FileManager consumes the integrated resource classifier and the shared Visual presentation seam rather than maintaining its own icon identity tables. `file-icons.ts` may read filesystem/application metadata needed to resolve a shortcut target or Element projection, but it delegates classification-to-artwork and native-handler fallback mapping to `visual/resource-presentation.ts`. `ResourceIcon` remains the renderer/composition primitive.

This means FileManager still owns presentation lifecycle that genuinely depends on its surface, such as image-thumbnail leases and resolving a shortcut target's metadata through `FsService`; it does **not** own MIME/type classification, native handler identity, application artwork fallback, shortcut execution, or shared icon sizing. Shortcut target artwork is composed with the shared shortcut overlay rather than replaced.

## Refactor direction

`FileManager.tsx` is a broad orchestration component. Continue extracting action availability/execution, async refresh coordination, context command models, and reusable interaction state into production modules where doing so makes behavior cheaper to test and shared by Desktop/Explorer.

Do not split by historical feature wave or create separate Desktop/Explorer operation stacks. Preserve one set of filesystem actions and capability-aware commands, with React responsible mainly for rendering and translating browser events. Keep operation state bounded to demonstrated FileManager workflows rather than turning it into a generic job manager.

## Testing

Use fast tests for selection/range/marquee math, clipboard/collision naming, operation-state transitions, refresh ordering, command eligibility, activation routing, rename/create/import/delete helpers, drag/drop decisions, filesystem action outcomes, persisted view preferences, and deterministic shared-presentation mapping. Hidden-file presentation tests must exercise the filesystem list contract rather than duplicating hidden-name classification in FileManager tests. Cross-surface activation and ordinary-Delete tests should use the shared headless Plasmon environment so FileManager's production adapters exercise the real filesystem dispatcher/Trash authority, associations, process/window state, protection policy, and Neutron boundary.

Use RTL/browser tests only where DOM mechanics are material, including the accessible running-status boundary for deliberately delayed import/paste operations, pointer capture/drag, keyboard routing/editable targets, file chooser/import, object-URL download behavior, focus/dialog/context-menu interaction, and packaged visible workflows. Installed Plasmon-owned artwork paths require packaged-browser coverage because standalone rendering cannot prove the Neutron application mount.

When a UI bug is fundamentally a shared command/model bug, add the regression below React first instead of relying only on click-path coverage.
