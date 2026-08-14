# FileManager

`file-manager/**` is the reusable filesystem presentation and interaction layer used by Desktop and Explorer-style applications. It renders authoritative `FsService` state and coordinates selection, rename, clipboard operations, drag/drop, create/import/download, context commands, Properties/Open With presentation, visibility preferences, operation status, and error reporting.

## Architecture

Deterministic behavior already lives in production helper modules such as:

- `model.ts` — selection, marquee geometry, refresh gating, rename helpers, and clipboard state;
- `operation-state.ts` — the small injectable FileManager operation lifecycle vocabulary for import/paste status, item counts, current import item, partial import failures, and duplicate-start protection;
- `file-entry-state.ts` — deterministic NodeId-keyed per-entry render state, consuming caller-supplied Desktop coordinates without allocating placement or owning resource semantics;
- `activation.ts` — the thin FileManager adapter to the canonical filesystem open authority, including caller-owned same-window directory navigation;
- `clipboard.ts` — collision-aware copy/cut/paste behavior;
- `create-import.ts`, `download.ts` — filesystem action helpers;
- `create-shortcut.ts` — capability-aware FileManager shortcut creation and Send to Desktop destination routing; serialization, stable target identity, and collision naming stay delegated to the canonical filesystem shortcut primitive;
- `delete.ts` — the thin ordinary-Delete adapter to the canonical filesystem Trash authority, including deterministic multi-selection success/failure reporting;
- `preferences.ts` — the small filesystem-backed FileManager presentation preference store;
- `visibility.ts` — the presentation-only filesystem view that selects the canonical `includeHidden` list mode without classifying resources itself;
- `keyboard.ts`, `drag.ts`, `drop-target.ts`, `rename.ts` — interaction decisions;
- `spatial-navigation.ts` — deterministic NodeId-preserving neighbor selection from browser-supplied entry rectangles for compact spatial views;
- `properties.tsx` — Properties/Open With presentation.

`FileManager.tsx` connects those models/actions to React state, DOM pointer/keyboard events, dialogs, and rendering. Import can truthfully expose per-item progress because FileManager already sequences those items. Paste exposes running/completed/failed lifecycle and the known total count, but does not invent byte or per-item progress that the existing filesystem paste boundary does not report.

`FileEntry.tsx` remains a small React/browser adapter around the pure render-state policy and the narrow async presentation/thumbnail hook. It renders and adapts browser input; it does not classify resources, allocate Desktop placement, own filesystem mutation, or replace canonical open/shortcut/Trash authorities.

FileManager is not a filesystem repository and must not grow private application-opening or Trash policy. All normal resource activation delegates to the filesystem core's canonical open dispatcher. FileManager may provide presentation-owned directory navigation so an existing Explorer window can navigate in place, but resource classification, shortcut dereference, system/Neutron application opening, and ordinary association dispatch remain filesystem/opening authority concerns.

Ordinary Delete delegates to the filesystem core's canonical Trash service. FileManager retains confirmation, selection reconciliation, and visible error presentation, while protection decisions, Trash metadata, stable-identity moves, restore, permanent deletion, and emptying remain filesystem authority concerns.

Create Shortcut eligibility follows canonical filesystem resource capabilities. The filesystem `createShortcut()` primitive owns shortcut metadata, unique-name allocation, and stable `NodeId` targets; FileManager owns command presentation and the created shortcut's selection, focus, inline rename, and visible error handling. Send to Desktop is the same shortcut operation with `/Desktop` resolved as the destination: the original resource is never moved or copied, including protected system or installed-application resources.

Hidden-resource classification also remains filesystem-owned. FileManager's `Show hidden files` preference stores only whether Explorer should request hidden entries, using namespaced metadata on the filesystem root through `FsService`. The visibility layer passes `includeHidden` to the canonical filesystem list contract and never reimplements hidden detection from filenames or metadata. Showing hidden entries changes presentation only and does not weaken resource protection.

### List presentation

List is deliberately distinct from Grid and Details. At normal Explorer widths it uses compact resource cells that make horizontal use of the viewport across multiple rendered columns. Details remains the full metadata-row presentation for Name/Type/Size/Modified-style columns; List must not grow a second metadata table or a separate selection/command implementation.

List arrow navigation follows the geometry that the browser actually rendered. `FileManager.tsx` supplies current entry rectangles to the pure `spatialNeighborId()` helper, which returns another stable `NodeId`; the existing `selectNode()` path then remains selection authority. If there is no resource in the requested spatial direction, focus remains on the current resource. Open, rename, context menu, drag/drop, shortcut/resource presentation, operation progress, and filesystem operations remain the same shared FileEntry/FileManager paths used by the other views.

Reference investigation for #173 found that daedalOS also models List as a dedicated compact FileManager view with compact rows while reusing shared focus/keyboard infrastructure. Plasmon's accepted #173 contract is more specific: normal-width List must visibly form multiple compact columns and horizontal arrow navigation must follow the resulting geometry. This note does not freeze an exact column count, breakpoint, CSS mechanism, or the future #196 architecture.

### Resource presentation boundary

FileManager consumes the integrated resource classifier and the shared Visual presentation seam rather than maintaining its own icon identity tables. `file-icons.ts` may read filesystem/application metadata needed to resolve a shortcut target or Element projection, but it delegates classification-to-artwork and native-handler fallback mapping to `visual/resource-presentation.ts`. `ResourceIcon` remains the renderer/composition primitive.

This means FileManager still owns presentation lifecycle that genuinely depends on its surface, such as image-thumbnail leases and resolving a shortcut target's metadata through `FsService`; it does **not** own MIME/type classification, native handler identity, application artwork fallback, shortcut execution, or shared icon sizing. Shortcut target artwork is composed with the shared shortcut overlay rather than replaced.

Desktop selected/focused label expansion and inline-rename geometry are FileEntry presentation concerns only. The #192 Desktop controller remains the sole allocator/reconciler of NodeId-keyed positions, and the shared #190 Visual seam remains the source of resource/application presentation identity.

## Refactor direction

`FileManager.tsx` is a broad orchestration component. Continue extracting action availability/execution, async refresh coordination, context command models, and reusable interaction state into production modules where doing so makes behavior cheaper to test and shared by Desktop/Explorer. Keep FileEntry's pure render-state plus narrow presentation-hook seam small rather than moving surrounding FileManager authorities into it.

Do not split by historical feature wave or create separate Desktop/Explorer operation stacks. Preserve one set of filesystem actions and capability-aware commands, with React responsible mainly for rendering and translating browser events. Keep operation state bounded to demonstrated FileManager workflows rather than turning it into a generic job manager.

## Testing

Use fast tests for selection/range/marquee math, clipboard/collision naming, operation-state transitions, refresh ordering, command eligibility, activation routing, rename/create/import/delete/shortcut helpers, drag/drop decisions, filesystem action outcomes, persisted view preferences, pure spatial navigation, deterministic FileEntry render state, and deterministic shared-presentation mapping. Hidden-file presentation tests must exercise the filesystem list contract rather than duplicating hidden-name classification in FileManager tests. Cross-surface activation and ordinary-Delete tests should use the shared headless Plasmon environment so FileManager's production adapters exercise the real filesystem dispatcher/Trash authority, associations, process/window state, protection policy, and Neutron boundary.

Use RTL/browser tests only where DOM mechanics are material, including the accessible running-status boundary for deliberately delayed import/paste operations, pointer capture/drag, keyboard routing/editable targets, file chooser/import, object-URL download behavior, focus/dialog/context-menu interaction, rendered List/Details geometry, bounded Desktop FileEntry rename geometry, bounded command discoverability such as Send to Desktop, and packaged visible workflows. Installed Plasmon-owned artwork paths require packaged-browser coverage because standalone rendering cannot prove the Neutron application mount.

When a UI bug is fundamentally a shared command/model bug, add the regression below React first instead of relying only on click-path coverage.
