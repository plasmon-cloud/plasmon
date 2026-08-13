# Issue #196 reconnaissance — wait for #195 implementation architecture

**RECONNAISSANCE COMPLETE — WAIT FOR #195 IMPLEMENTATION ARCHITECTURE**

This is not an acceptance gate. No production code or architecture-dependent
RED test is staged for #196.

## Current view inventory

The active Explorer selects `grid`, `list`, or `details` and passes the mode
straight through `ExplorerApp -> FileManager -> FileEntry`.

- **Grid / current Icons-like view:** `.fm-root--grid .fm-entries` uses a
  responsive CSS grid with 104px minimum columns. `FileEntry` renders icon and
  name. Selection, activation, rename, context menu, clipboard, and drag
  handlers are shared in `FileManager`.
- **List:** `.fm-root--list .fm-entries` is currently a single vertical flex
  column. `FileEntry` uses a 30px icon column plus one name column. It is not a
  compact multi-column/list strategy; this is the concrete #173 defect.
- **Details:** `.fm-root--details .fm-entries` is a vertical flex column.
  `FileEntry` adds Type, Size, and Modified cells, matching the separate
  details header grid. Metadata formatting currently lives in `FileEntry`.
- **Desktop:** separate absolute NodeId-keyed placement and is outside #196's
  general view redesign; #192 owns placement policy and #191 owns entry
  presentation.

## Shared semantics already present

`FileManager.tsx` provides one shared path for:

- NodeId-backed selection, additive/range/select-all/clear behavior;
- keyboard F2/delete/copy/cut/paste and Enter/Escape handling;
- rename editor presentation and canonical `FsService.rename` execution;
- canonical filesystem activation and directory navigation callback;
- context-menu target selection and command presentation;
- Trash/Delete, clipboard, Create Shortcut, import/create/download,
  Properties/Open With;
- drag/drop selection, directory target validation, and Desktop reposition;
- refresh/event reconciliation and shared resource presentation consumed by
  `FileEntry`.

These must be characterized once and consumed by each future strategy, not
retested as three separate command implementations.

## View-specific or duplicated behavior to resolve later

- Spatial layout and keyboard movement are not separated from the adapter.
  Current arrow keys use one linear ordered-ID step for every mode; that is not
  a deliberate grid/list/details navigation contract.
- List has no column-flow or horizontal efficiency policy and currently differs
  from Details mainly by omitting metadata cells.
- Details has a mode-specific header and metadata columns, but metadata label
  derivation (`typeLabel`, size formatting, date formatting) remains coupled to
  `FileEntry` rendering.
- Grid owns CSS grid placement but has no pure layout/navigation helper.
- Icon context sizing is shared, while view-specific icon contexts are selected
  in `FileEntry`; future work must not reintroduce resource classification or
  presentation authority per view.
- Rename, context, and drag browser adapters are shared today; any view
  strategy must pass the same command/event seams rather than fork them.

## Existing evidence and guards

- `src/os/file-manager/file-manager.test.ts`: shared selection, marquee,
  rename, clipboard, drop, refresh, and identity policy.
- `src/os/file-manager/gate3.test.tsx` and `polish.test.tsx`: entry state,
  keyboard routing, drop target, rename, and presentation helpers.
- `src/os/file-manager/file-icons.test.ts` and visual tests: shared resource
  presentation, shortcut composition, thumbnails, and fallbacks.
- `src/os/file-manager/desktop-label.test.tsx`: Desktop-only label states.
- `src/native-apps/explorer/navigation.test.ts`: Explorer history/NodeId
  navigation independent of view mode.
- `test/rtl/renderPlasmon.test.tsx`: assembled FileManager interaction path;
  it does not currently assert mode-specific rendered geometry.
- #187 packaged smoke: tolerant common-path geometry, not List/Details design.
- #173: concrete requirement that List become visibly/functionally distinct,
  horizontal-efficient, and receive browser/visual geometry coverage.

## Likely future classifications

### PRESERVE

- One canonical resource/selection/command model across all modes.
- NodeId identity through rename/move/open/Trash/shortcut workflows.
- Shared classification/presentation, thumbnail, shortcut, context, and
  accessibility semantics.
- Directory navigation and Explorer history authority.

### CHANGE

- Explicit view strategies with deterministic layout inputs and mode-specific
  keyboard navigation.
- A deliberate List layout satisfying #173 rather than Details-minus-columns.
- Details metadata columns and responsive behavior as an explicit strategy.
- Browser geometry checks for actual flow, hit targets, responsive overflow,
  rename anchoring, and selection consistency across modes.

### UNSPECIFIED

- Final strategy interface, component names, CSS class names, exact column
  count/flow algorithm, sorting UI, and responsive breakpoints.
- Whether Details remains a grid or becomes table-like.
- Exact icon sizes, typography, screenshots, and broad Explorer redesign.

## Architecture dependencies

Do not finalize #196 RED gates until #195 demonstrates the surviving adapter
and view inputs. #195 may move selection/keyboard/context/drag/render
composition and may expose different production seams. After that evidence,
#196 should add pure layout/navigation tests, RTL mode semantics, and only
focused browser geometry for claims that require real layout. Any #173 gate
must remain separately owned unless its full criteria are actually satisfied.
