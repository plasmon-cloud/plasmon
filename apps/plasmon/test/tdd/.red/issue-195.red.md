# Issue #195 packet — FileManager decomposition specification

This packet is a decomposition fence, not a source-shape test. It records the
responsibility/authority map for the current active FileManager adapter,
indexes existing guards, and adds only the uncovered deterministic refresh
boundary characterization. No product behavior is changed on this Luna
branch.

## Starting state

The active path is:

```text
PlasmonOS -> Desktop / native Explorer -> FileManager.tsx
          -> FileManager production helpers/models
          -> FsService, TrashService, associations/open, Process/Windowing
```

`FileManager.tsx` is a broad React/browser orchestration component. It already
consumes substantial extracted helpers (`model.ts`, `activation.ts`,
`clipboard.ts`, `create-import.ts`, `create-shortcut.ts`, `delete.ts`,
`drag.ts`, `drop-target.ts`, `keyboard.ts`, `properties.tsx`) but still owns
composition, local UI state, browser event translation, command dispatch, and
rendering in one function.

## Current FileManager responsibility map

| Responsibility | Current production location | Classification | Authority/boundary to preserve |
|---|---|---|---|
| directory stat/list, loading, error, stale refresh | `FileManager.tsx` `refresh`; `RefreshGate`/`isFsEventRelevant` in `model.ts` | ADAPTER + DETERMINISTIC POLICY | `FsService` and `FsEventSource` remain authoritative; invalidation triggers re-read |
| visible filtering and ordered IDs | `FileManager.tsx` `visibleNodes`/`orderedIds` | PRESENTATION | authoritative `FsNode` list; no local resource database |
| desktop position projection | `FileManager.tsx` + `desktop/layout.ts` | DETERMINISTIC POLICY + ADAPTER | Desktop placement controller/#192; NodeId metadata, not React state |
| single/additive/range/select-all/clear selection | `model.ts` called by `FileManager.tsx` | DETERMINISTIC POLICY | NodeId-backed selection model |
| focus and keyboard command routing | `FileManager.tsx` `handleKeyDown`; `keyboard.ts`; `model.ts` | ADAPTER + DETERMINISTIC POLICY | FileManager focus/selection presentation; editable targets are excluded |
| rename draft/editor state | `FileManager.tsx` state + `rename.ts`/`model.ts` helpers | ADAPTER + PRESENTATION | NodeId target; filesystem rename owns mutation |
| rename execution and refresh | `FileManager.tsx` `commitRename` -> `renameNode` | ADAPTER | `FsService.rename` and canonical errors |
| context-menu target and browser suppression | root/entry/menu `onContextMenu` handlers in `FileManager.tsx` | ADAPTER | Plasmon-owned context boundary/#176; commands remain canonical |
| open/activation | `FileManager.tsx` -> `activateFileManagerNode` | ADAPTER | filesystem open dispatcher / association / Neutron / native process authority |
| directory navigation callback | `onOpenDirectory` through activation adapter | ADAPTER | FileManager/Explorer presentation-owned history; filesystem identity remains NodeId |
| copy/cut clipboard state | `FileOperationClipboard` + `copySelection`/`cutSelection` | AUTHORITY (bounded clipboard model) + ADAPTER | canonical clipboard model; no React-only clipboard database |
| paste collision policy and mutations | `clipboard.ts` called by `paste` | DETERMINISTIC POLICY + ADAPTER | FsService copy/move and collision naming |
| Trash/Delete confirmation and error aggregation | `removeNodes` -> `deleteFilesystemNodes` | ADAPTER | `TrashService`/resource policy; FileManager owns confirmation and visible errors |
| create folder/document/import | `create-import.ts` called by handlers | ADAPTER | FsService creation/write; import bytes and cleanup remain filesystem action helpers |
| Create Shortcut | `create-shortcut.ts` called by handlers | ADAPTER | canonical shortcut primitive, stable target identity, capability policy |
| Properties/Open With | `properties.tsx`, `OpenWithPanel`, local dialog state | PRESENTATION + ADAPTER | association/Open With and filesystem inspection authorities |
| download | `download.ts` called by handler | ADAPTER + BROWSER MECHANISM | FsService read and browser object URL/download boundary |
| pointer selection / group drag threshold | `handleEntryPointerDown/Move/Up` + `model.ts`/`drag.ts` | ADAPTER + DETERMINISTIC POLICY | selection model and canonical drop/move/placement outcomes |
| pointer capture / animation-frame transforms | `FileManager.tsx` refs and DOM methods | EXTERNAL/BROWSER MECHANISM | browser pointer capture and visual-only drag representation; no window z-order authority |
| directory drop validation/outcome | `drop-target.ts`, `model.ts::moveNodesToDirectory` | DETERMINISTIC POLICY + ADAPTER | FsService move and directory ancestry rules |
| marquee geometry and selection | `captureMarqueeRectangles`, `marqueeSelection` + pointer refs | DETERMINISTIC POLICY + EXTERNAL/BROWSER MECHANISM | rectangle math below React; actual pointer capture/browser geometry at browser layer |
| resource rendering | `FileEntry.tsx` and shared visual/file presentation | PRESENTATION | shared resource presentation/#190/#189; no local type/icon authority |
| view mode markup | `FileManager.tsx`, `FileEntry.tsx`, CSS | PRESENTATION | Icons/List/Details strategy is #196; not absorbed here |
| filesystem error/diagnostic presentation | `ErrorBanner`, local `error` state, Properties/Open With panels | PRESENTATION | user-visible error state; #86 may be fixed only if fully proven |

### Duplicated or React-trapped policy found

- Desktop position resolution is now delegated to the integrated #192
  controller on the release head; this staging lane's pre-integration source
  still shows the old adapter and must not be used to infer current release
  cleanup.
- Context action mapping (`menuAction`) and keyboard-to-action dispatch are
  concentrated in the adapter, though the underlying commands are delegated.
- Rename commit orchestration, create/import refresh/selection sequencing, and
  Delete confirmation/error aggregation remain local async callbacks.
- Drag target lookup combines `document.elementFromPoint` with domain target
  filtering in the component; deterministic filtering exists below React, but
  the browser mechanism remains embedded in the adapter.
- Marquee pointer lifecycle, RAF scheduling, and rectangle projection remain
  component refs/state around already-extracted geometry helpers.
- `FileEntry` rendering and mode-specific CSS remain composed from the broad
  adapter; view strategy reconstruction is explicitly #196.

These are refactor opportunities, not standalone product failures. The packet
therefore does not assert line counts, component names, private state shape, or
imports as acceptance criteria.

## Authority map

- **Filesystem authority:** `FsService`, filesystem core/resource policy,
  `TrashService`, stable `NodeId`, mutation/persistence, hidden classification.
- **Opening authority:** `FilesystemOpenDispatcher` through
  `FileManagerOpenAuthority`; `AssociationRegistry`/`OpenService`, native
  Process/Windowing, and Neutron bridge retain their owners.
- **Clipboard authority:** `FileOperationClipboard` plus canonical FsService
  copy/move; FileManager only presents actions and refreshes.
- **Shortcut authority:** filesystem `createShortcut`/metadata and canonical
  dispatcher dereference; FileManager only selects and presents.
- **Presentation authority:** shared resource classification/presentation and
  visual primitives (#189/#190); FileEntry must consume, not re-infer.
- **FileManager adapter authority:** navigation presentation, selection/focus
  interaction state, context/error presentation, and browser event translation.
- **Browser mechanisms:** pointer capture, `elementFromPoint`, RAF, file input,
  object URLs/download, actual focus/hit-testing/geometry. These are not domain
  authorities.

## Existing guard inventory

### Deterministic/model/headless

- `src/os/file-manager/file-manager.test.ts`: selection toggle/add/range,
  selected-group pointer semantics, marquee intersection/capture, rename
  service semantics, clipboard copy/cut, drop ancestry validation, refresh
  generation, Explorer history/NodeId, Properties inspection/effective open
  handler, and association opening.
- `src/os/file-manager/gate3.test.tsx`: Delete key/editable target routing,
  generated names, collision naming, rename basename policy, entry state,
  directory drop target, download, shortcut identity, context ownership.
- `src/os/file-manager/final-gate.test.ts`: create/import MIME/bytes/chunking,
  partial cleanup, ordinary resource types, pointer cancellation.
- `src/os/file-manager/polish.test.tsx`: rename keyboard semantics, desktop
  allocation, clipboard naming, keyboard routing, address resolution, error
  dismissal, thumbnail behavior.
- `src/os/file-manager/create-shortcut.test.tsx`: canonical shortcut creation,
  collision/selection/rename, eligibility, and command surface.
- `src/os/file-manager/preferences.test.ts`: filesystem-backed hidden-file
  preference and canonical hidden classification.
- `src/os/file-manager/open-with-gui.test.ts`: Open With selection/default,
  one-off dispatch, persistence, and visible error behavior.
- `src/os/file-manager/file-icons.test.ts`: shared resource/application
  presentation, shortcut target composition, missing/failure fallback.
- `test/fileManagerActivation.test.ts`: FileManager activation delegates to
  canonical opening for directories, shortcuts, associations, system apps,
  and Neutron projections.
- `test/fileManagerDelete.test.ts` and `test/trashLifecycle.test.ts`: Delete
  delegates to TrashService, protected-resource errors, stable identity,
  restore, and cross-surface Trash lifecycle.
- `test/resourceOpenCrossSurface.test.ts`: FileManager, Start, and Search
  share canonical activation outcomes.
- `test/refactorGuards.test.ts`: assembled authorities, opening, Process/
  Windowing, projections, NodeId lifecycle, persistence/recomposition.

### RTL

- `test/rtl/renderPlasmon.test.tsx`: real assembled Desktop/FileManager click,
  context-menu, rename/Enter, Properties, directory activation, taskbar
  minimize/restore, Start, and Search adapters.
- `test/rtl/refactorGuardSmoke.test.tsx`: assembled React projection of
  filesystem/Shell/Process/Windowing authorities without parallel state.

### Browser/package

- `test/e2e/plasmon-refactor-smoke.spec.ts` and #187 health helper: packaged
  boot, first-party health, Desktop/FileManager gross geometry, common native
  window/taskbar/Search paths, and browser-owned boundaries.
- Specialist packaged specs own Review, Monaco, runtime, persistence, media,
  and other actual browser/package claims. No broad FileManager browser suite
  is warranted for deterministic semantics.

## PRESERVE

- Navigation remains an adapter over stable filesystem identity and canonical
  directory opening; no alternate path/resource database.
- NodeId-backed single, additive, range, keyboard, marquee, and group-drag
  selection behavior remains intact.
- Enter/Escape/F2 rename semantics, filesystem mutation, and error visibility
  remain intact.
- Activation continues through the one filesystem/open authority for ordinary
  files, directories, shortcuts, native apps, runtimes, and Neutron projections.
- Context menus suppress the browser on first-party FileManager surfaces while
  preserving specialized command ownership and editable/foreign boundaries.
- Clipboard, Trash, shortcut, Properties/Open With, associations, resource
  classification, and shared presentation remain canonical external authorities.
- Drag/drop validation, stable identities, and accepted marquee/selection
  outcomes remain unchanged; browser mechanics may be relocated.
- FileManager remains a presentation/interaction adapter, not a filesystem,
  application registry, Trash store, or command replacement.

## CHANGE / decomposition fence

- Extract deterministic policy/state transitions from the broad adapter where
  a real production seam exists; keep React as event translation and rendering.
- Separate resource-surface rendering, selection/keyboard adapter, rename
  presentation, context-menu presentation, and drag/marquee browser adapters
  without freezing component names or file layout.
- Route each extracted adapter to the existing canonical command/service/model;
  no duplicate FileManager2 command stack or long-lived feature switch.
- Use #176's first-party context ownership seam rather than scattering browser
  suppression as new components are extracted.
- Consume #189 classification and #190 shared presentation; extracted entry
  surfaces must not grow new icon/MIME/type tables.
- Keep #192 placement policy outside React and consume its resolved output.
- Keep browser-only pointer capture/hit-testing/file-input/download behavior at
  the browser boundary; deterministic decisions remain testable below it.
- Delete superseded local helpers/state/CSS after each responsibility migrates,
  while preserving the current observable behavior.

## UNSPECIFIED

- Component names, count, directory/file layout, private state shape, CSS class
  names, line counts, exact call graph, and exact helper signatures.
- Icons/List/Details redesign and spatial keyboard policy (#196).
- New commands/features, global Shell redesign, Trash redesign, operation
  progress (#65/#92), drag-preview layering (#66), and concrete List defect
  (#173).
- Exact visual spacing, typography, screenshots, or broad geometry beyond
  existing #187 tolerant smoke contracts.

## New characterization guard

`issue-195.red.test.ts` covers the currently unprotected deterministic refresh
boundary:

- child creation/change/move-in/move-out/removal and reset events are relevant
  to the displayed directory;
- unrelated changes/removals do not trigger a directory refresh;
- selection reconciliation removes deleted NodeIds while preserving surviving
  focus/anchor identity.

It uses `model.ts` directly and adds no fake React/FileManager implementation.
All other accepted behavior is already represented by the indexed focused,
headless, and RTL guards; duplicating it in another `.red` layer would inflate
the packet without improving decomposition safety.

## Intentional RED gates

No truthful implementation-independent behavioral RED was found for #195 at
this current head. The current accepted FileManager commands, selection,
activation, Trash, shortcut, presentation, rename, context-menu, and drag
policy are already green at their lowest truthful layers. A source-shape gate
such as “FileManager.tsx is smaller” or “component X exists” would violate #195
and #187's architecture rules and is intentionally not staged.

The packet is therefore a **characterization/indexing packet awaiting the
production decomposition**, not a fabricated failing test. The decomposition
itself must preserve the listed external contracts; any newly discovered
behavioral defect should receive its own smallest canonical Issue rather than
being hidden under #195.

## Browser/pointer/hit-test boundary

No new Playwright gate is staged. Existing #187 packaged smoke proves the
common FileManager/Desktop geometry and browser health. Pointer capture,
`elementFromPoint`, marquee hit testing, file chooser, download, and foreign
content boundaries are genuine browser mechanisms, but current #195 scope has
no demonstrated failing behavior beyond architecture placement. A future
focused browser gate is appropriate only if decomposition exposes a concrete
regression or a reusable #176 event-ownership seam.

## Implementor adoption instructions

Adopt the responsibility map and characterization test, then decompose
incrementally around production seams. Keep `FileManagerOpenAuthority`,
`TrashService`, `FileOperationClipboard`, `FsService`, Association/Open
services, canonical shortcut/presentation/classification, and Process/Windowing
contracts unchanged. Move only event translation/render composition and
FileManager-owned navigation/selection/error state into focused adapters.
Delete superseded state/helpers/CSS as each migration lands; do not leave a
parallel FileManager implementation. Re-run all indexed guards and the #187
smoke, and report whether the #191 pattern should be repeated for later view
strategies (#196).

## Commands

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-195.red.test.ts
bun test apps/plasmon/src/os/file-manager
bun test ./apps/plasmon/test/rtl/renderPlasmon.test.tsx
npm --workspace neutron-plasmon test
```

The explicit #195 gate is expected to pass (characterization). No intentional
RED is claimed; any failure in the focused or fast baseline is a regression,
not evidence that decomposition is incomplete.
