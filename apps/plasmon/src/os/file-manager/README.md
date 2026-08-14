# FileManager

`file-manager/**` is the reusable filesystem presentation and interaction layer used by Desktop and Explorer-style applications. It renders authoritative `FsService` state and coordinates selection, rename, clipboard operations, drag/drop, create/import/download, context commands, Properties/Open With presentation, visibility preferences, operation status, and error reporting.

## Architecture

Deterministic behavior lives in production helper modules such as:

- `model.ts` — selection, marquee geometry, refresh gating, rename helpers, and clipboard state;
- `operation-state.ts` — the small injectable FileManager operation lifecycle vocabulary for import/paste status, item counts, current import item, partial import failures, and duplicate-start protection;
- `operation-presentation.ts` — pure mapping from the accepted operation snapshot to truthful running/status presentation;
- `render-state.ts` — deterministic filtering, stable NodeId render order, snapshot derivation, and pass-through of caller-owned Desktop coordinates;
- `file-entry-state.ts` — deterministic NodeId-keyed per-entry render state, consuming caller-supplied Desktop coordinates without allocating placement or owning resource semantics;
- `view-strategy.ts` — explicit Grid/List/Details rendered-view policy for shared FileEntry presentation, view-owned metadata arrangement, and view-specific navigation without owning commands or resource semantics;
- `activation.ts` — the thin FileManager adapter to the canonical filesystem open authority, including caller-owned same-window directory navigation;
- `clipboard.ts` — collision-aware copy/cut/paste behavior;
- `create-import.ts`, `download.ts` — filesystem action helpers;
- `create-shortcut.ts` — capability-aware FileManager shortcut creation and Send to Desktop destination routing; serialization, stable target identity, and collision naming stay delegated to the canonical filesystem shortcut primitive;
- `delete.ts` — the thin ordinary-Delete adapter to the canonical filesystem Trash authority, including deterministic multi-selection success/failure reporting;
- `preferences.ts` — the small filesystem-backed FileManager presentation preference store;
- `visibility.ts` — the presentation-only filesystem view that selects the canonical `includeHidden` list mode without classifying resources itself;
- `keyboard.ts`, `drag.ts`, `drop-target.ts`, `rename.ts` — interaction decisions;
- `spatial-navigation.ts` / `list-layout.ts` — deterministic NodeId-preserving neighbor selection from browser-supplied entry rectangles for compact spatial views;
- `properties.tsx` — Properties/Open With presentation.

`FileManager.tsx` is the composition root and humble React adapter. It retains legitimate transient React state such as selection and currently-open menus/dialogs, subscribes to operation snapshots, and translates rendered events into focused adapters. It no longer contains independent refresh, rename, command, keyboard, drag, marquee, resource-surface, command-bar, context-menu, dialog, or non-Desktop view-rendering implementations.

The main #195 adapter seams are:

- `use-file-manager-directory-state.ts` — React lifecycle around canonical `RefreshGate`, filesystem-event relevance, authoritative listing, and NodeId selection reconciliation;
- `use-file-manager-commands.ts` — UI invocation wiring that delegates to activation/open, clipboard/paste, create/import, shortcut, Trash/delete, download, `FsService`, and #65 operation authorities;
- `use-file-manager-rename.ts` — inline editor lifecycle around canonical `renameNode`/`FsService` mutation;
- `use-file-manager-keyboard-adapter.ts` — DOM keyboard translation into existing command/selection/spatial-navigation policy;
- `use-file-manager-pointer-adapter.ts` — pointer capture, `elementFromPoint`, RAF transforms, drag visual cleanup, and marquee DOM adaptation around existing drag/drop/selection policy. Drag-originated directory moves intentionally remain outside #65 operation state because #92 owns that separate product RED;
- `FileManagerEntries.tsx`, `FileManagerCommandBar.tsx`, `FileManagerContextMenu.tsx`, and `FileManagerDialogs.tsx` — render-only typed adapters that receive state/callbacks and own no filesystem, open, Trash, classification, placement, or operation authority. For Grid/List/Details, `FileManagerEntries.tsx` consumes the selected `FileManagerViewStrategy`; Desktop instead consumes caller-owned #192 positions directly and remains outside the view-strategy migration.

Import can truthfully expose per-item progress because FileManager already sequences those items. Paste exposes running/completed/failed lifecycle and the known total count, but does not invent byte or per-item progress that the existing filesystem paste boundary does not report.

`FileEntry.tsx` remains a small React/browser adapter around the pure render-state policy and the narrow async presentation/thumbnail hook. It renders and adapts browser input; it does not classify resources, allocate Desktop placement, own filesystem mutation, or replace canonical open/shortcut/Trash authorities.

FileManager is not a filesystem repository and must not grow private application-opening or Trash policy. All normal resource activation delegates to the filesystem core's canonical open dispatcher. FileManager may provide presentation-owned directory navigation so an existing Explorer window can navigate in place, but resource classification, shortcut dereference, system/Neutron application opening, and ordinary association dispatch remain filesystem/opening authority concerns.

Ordinary Delete delegates to the filesystem core's canonical Trash service. FileManager retains confirmation, selection reconciliation, and visible error presentation, while protection decisions, Trash metadata, stable-identity moves, restore, permanent deletion, and emptying remain filesystem authority concerns.

Create Shortcut eligibility follows canonical filesystem resource capabilities. The filesystem `createShortcut()` primitive owns shortcut metadata, unique-name allocation, and stable `NodeId` targets; FileManager owns command presentation and the created shortcut's selection, focus, inline rename, and visible error handling. Send to Desktop is the same shortcut operation with `/Desktop` resolved as the destination: the original resource is never moved or copied, including protected system or installed-application resources.

Hidden-resource classification also remains filesystem-owned. FileManager's `Show hidden files` preference stores only whether Explorer should request hidden entries, using namespaced metadata on the filesystem root through `FsService`. The visibility layer passes `includeHidden` to the canonical filesystem list contract and never reimplements hidden detection from filenames or metadata. Showing hidden entries changes presentation only and does not weaken resource protection.

### Rendered view strategies

Grid, List, and Details are explicit rendered strategies over one canonical FileManager model. `FileManager.tsx` selects the strategy from the existing presentation value and passes that strategy, rather than raw non-Desktop presentation state, into the entries adapter. The strategy supplies the shared `FileEntry` presentation, view-specific navigation policy, and view-owned arrangement metadata such as the Details column labels. The entries adapter keeps one NodeId-keyed `FileEntry` mapping and one callback surface for selection, open, rename, context menu, pointer/drag, and drop behavior.

Desktop is intentionally not a fourth migrated strategy. Desktop keeps the shared FileEntry/resource semantics but consumes #192 caller-owned NodeId positions through the explicit Desktop entries mode. A view strategy must not acquire filesystem, activation/open, rename execution, Trash, clipboard, operation-state, resource-classification/presentation, FileEntry, or Desktop-placement authority.

### List presentation

List is deliberately distinct from Grid and Details. At normal Explorer widths it uses compact resource cells that make horizontal use of the viewport across multiple rendered columns. Details remains the full metadata-row presentation for Name/Type/Size/Modified-style columns; List must not grow a second metadata table or a separate selection/command implementation.

List arrow navigation follows the geometry that the browser actually rendered. The FileManager pointer/browser adapter supplies current entry rectangles to the pure `spatialNeighborId()` helper, which returns another stable `NodeId`; the existing `selectNode()` path then remains selection authority. If there is no resource in the requested spatial direction, focus remains on the current resource. Grid uses the same browser-rectangle spatial contract for its responsive two-dimensional arrangement. Details remains ordered-row navigation. Open, rename, context menu, drag/drop, shortcut/resource presentation, operation progress, and filesystem operations remain the same shared FileEntry/FileManager paths used by all three strategies.

Reference investigation for #173 found that daedalOS also models List as a dedicated compact FileManager view with compact rows while reusing shared focus/keyboard infrastructure. Plasmon's accepted #173 contract is more specific: normal-width List must visibly form multiple compact columns and horizontal arrow navigation must follow the resulting geometry. This note does not freeze an exact column count, breakpoint, or CSS mechanism.

### Resource presentation boundary

FileManager consumes the integrated resource classifier and the shared Visual presentation seam rather than maintaining its own icon identity tables. `file-icons.ts` may read filesystem/application metadata needed to resolve a shortcut target or Element projection, but it delegates classification-to-artwork and native-handler fallback mapping to `visual/resource-presentation.ts`. `ResourceIcon` remains the renderer/composition primitive.

This means FileManager still owns presentation lifecycle that genuinely depends on its surface, such as image-thumbnail leases and resolving a shortcut target's metadata through `FsService`; it does **not** own MIME/type classification, native handler identity, application artwork fallback, shortcut execution, or shared icon sizing. Shortcut target artwork is composed with the shared shortcut overlay rather than replaced.

Desktop selected/focused label expansion and inline-rename geometry are FileEntry presentation concerns only. The #192 Desktop controller remains the sole allocator/reconciler of NodeId-keyed positions, and the shared #190 Visual seam remains the source of resource/application presentation identity.

## Refactor direction

Keep the #195 decomposition boundary: deterministic policy and canonical commands remain below React; browser-owned mechanisms stay in narrow adapters; typed render components receive state and callbacks without acquiring domain authority. Do not collapse these seams back into `FileManager.tsx`, and do not create a second Desktop/Explorer command stack merely to support future view work.

The #196 strategy boundary is intentionally narrow: later view work may extend deterministic spatial/layout or presentation-arrangement policy through `FileManagerViewStrategy`, but all views must continue to consume the shared FileEntry, selection, activation/open, rename, command, drag/drop, Trash, clipboard, operation-state, resource-classification/presentation, and NodeId contracts. Keep operation state bounded to demonstrated FileManager workflows rather than turning it into a generic job manager.

## Testing

Use fast tests for selection/range/marquee math, clipboard/collision naming, operation-state transitions and presentation, refresh ordering, command eligibility, activation routing, rename/create/import/delete/shortcut helpers, drag/drop decisions, filesystem action outcomes, persisted view preferences, pure view-strategy/spatial navigation, deterministic FileManager render state, deterministic FileEntry render state, and deterministic shared-presentation mapping. Hidden-file presentation tests must exercise the filesystem list contract rather than duplicating hidden-name classification in FileManager tests. Cross-surface activation and ordinary-Delete tests should use the shared headless Plasmon environment so FileManager's production adapters exercise the real filesystem dispatcher/Trash authority, associations, process/window state, protection policy, and Neutron boundary.

Use RTL/browser tests only where DOM mechanics are material, including semantic Grid/List/Details strategy cutover through the production Explorer composition, the accessible running-status boundary for deliberately delayed import/paste operations, pointer capture/drag, keyboard routing/editable targets, file chooser/import, object-URL download behavior, focus/dialog/context-menu interaction, rendered List/Details geometry, bounded Desktop FileEntry rename geometry, bounded command discoverability such as Send to Desktop, and packaged visible workflows. Installed Plasmon-owned artwork paths require packaged-browser coverage because standalone rendering cannot prove the Neutron application mount.

Do not add source-shape assertions for FileManager component names, hook counts, extracted filenames, import topology, CSS class structure, callback names, or line count. Protect observable behavior and canonical authority seams instead.

When a UI bug is fundamentally a shared command/model bug, add the regression below React first instead of relying only on click-path coverage.
