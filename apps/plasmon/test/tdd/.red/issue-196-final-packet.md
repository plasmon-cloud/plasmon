# Issue #196 — final FileManager view-strategy implementation packet

Disposition: **INTEGRATED / ALREADY GREEN — NO IMPLEMENTATION REQUIRED**.
This packet is retained as the #196 strategy preservation and authority fence.

Checkpoint: `4024addc4902cd019b64df548e4fb2dbf84cd053`
Release base: `4024addc4902cd019b64df548e4fb2dbf84cd053`
Merged dependencies: PR #213 / Issue #195 and PR #215 / Issue #196 are
integrated at this release head.

This packet consumes the actual merged #195 architecture. It does not reason
from the former monolithic `FileManager.tsx` shape and does not authorize a
second FileManager, presentation, filesystem, or operation authority.

## Reconciled current architecture

#195 provides the humble adapter composition root and #196 now provides the
explicit view strategy seam. The accepted architecture is:

- `use-file-manager-directory-state.ts` owns React lifecycle around
  authoritative listing, `RefreshGate`, filesystem-event relevance, and
  NodeId-keyed selection reconciliation.
- `use-file-manager-commands.ts` wires UI actions to canonical activation,
  clipboard, import, shortcut, Trash/delete, download, and #65 operation
  authorities.
- `use-file-manager-rename.ts` adapts the canonical rename helper.
- `use-file-manager-keyboard-adapter.ts` translates DOM keys into shared
  keyboard/selection/spatial policy.
- `use-file-manager-pointer-adapter.ts` owns browser pointer capture,
  `elementFromPoint`, RAF drag visuals, marquee adaptation, and invokes the
  existing drag/drop policy.
- `render-state.ts` owns filtering, stable visible NodeId order, snapshots, and
  caller-owned Desktop coordinate pass-through.
- `FileManagerEntries.tsx` is a typed render adapter; `FileEntry.tsx` remains
  the shared per-resource render/presentation authority.

The existing `presentation` value `"grid"` is the integrated Icons strategy;
`view-strategy.ts` now defines Grid/List/Details strategy policy. Do not
introduce a parallel `"icons"` mode merely to satisfy the issue wording.
`"desktop"` remains a Desktop placement consumer and is outside #196's
view-strategy scope.

## PRESERVE:

### Shared view contract and authorities

All three strategies consume one typed input/model carrying the authoritative
visible `FsNode[]`, stable ordered `NodeId[]`, selection/focus/anchor,
rename/drop state, and callbacks supplied by the #195 adapters. A strategy may
choose layout and view-specific keyboard interpretation only. It must not own
filesystem reads/mutations, activation, association selection, shortcut
dereference, Trash, clipboard, operation lifecycle, classification, or
placement.

Preserve one shared `FileEntry` path for resource identity, selected/focused
state, rename, pointer/context events, drop target state, shortcut artwork,
thumbnail lifecycle, and accessibility semantics. Do not clone FileEntry into
Icons/List/Details-specific entries.

### Integrated behavior

- **#173 List:** normal-width List forms compact columns; horizontal navigation
  follows actual rendered geometry through the existing `spatialNeighborId`
  contract; no-candidate navigation remains stable.
- **#189:** `classifyResource` and its accepted resource-kind vocabulary remain
  the classifier authority.
- **#190:** `ResourceIcon`, shared resource presentation, native/application
  artwork, and shortcut-overlay composition remain the presentation authority.
- **#191:** `file-entry-state.ts`, `FileEntry.tsx`, and
  `use-file-entry-presentation.ts` remain the NodeId-keyed entry and narrow
  presentation lifecycle authority.
- **#192:** Desktop position allocation/reconciliation remains in Desktop;
  #196 must not generalize or relocate `positions` handling.
- Selection, activation, rename, context menu, drag/drop eligibility,
  clipboard, Trash/delete, operation status, errors, hidden preference,
  thumbnails, and stable NodeId identity remain common behavior.
- Existing `render-state.ts` filtering/order and #195 snapshot semantics remain
  below any strategy.

## CHANGE:

Make Icons/Grid, List, and Details explicit view strategies over the existing
#195 input boundary.

1. Define one strategy input/output contract for visible resources, common
   `FileEntry` props/callbacks, selection state, and view-owned layout metadata.
   Keep the contract typed and compositional; it must not accept or create a
   second command/service registry.
2. Extract pure layout/navigation policy where deterministic. Icons may own
   responsive icon-cell arrangement; List owns its compact-column arrangement
   and consumes browser rectangles for #173 spatial navigation; Details owns
   metadata-column row arrangement. Every returned identity remains a NodeId.
3. Keep the existing FileEntry renderer shared. Details may supply the
   metadata-row presentation through the shared strategy/render seam, but must
   not create a parallel classifier, icon resolver, rename editor, or command
   path.
4. Wire strategy selection from the existing `presentation` value through
   `FileManager.tsx`/`FileManagerEntries.tsx` as thin composition only. Do not
   move #195 command, directory, rename, keyboard, pointer, operation, or
   Desktop authorities back into the composition root.
5. Preserve #173's integrated List contract while removing only genuinely
   superseded view CSS/helpers after the replacement has equivalent semantic and
   focused geometry evidence. Do not delete `spatial-navigation.ts` or its
   tests merely because a strategy module is introduced.
6. Add the lowest truthful coverage: Bun tests for pure strategy/layout
   semantics, RTL for common interaction equivalence and accessible rendered
   semantics, and narrowly scoped browser tests for real responsive geometry,
   hit testing, focus, and spatial behavior.

## UNSPECIFIED:

- strategy/component/module names and exact input/output type names;
- whether strategies are functions, components, render policies, or a small
  controller plus render adapter;
- CSS mechanism, breakpoints, exact column count, dimensions, column widths,
  DOM nesting, and visual tokens;
- Details' exact table/grid implementation, provided its Name/Type/Size/Modified
  semantics and accessibility remain intact;
- whether Icons and List share a pure grid helper, provided their accepted
  geometry and keyboard contracts remain distinct where required;
- migration order, except that shared semantics remain proven while each view
  moves and superseded CSS/helpers are removed only after proof.

Never turn these unspecified details into source-shape, filename, component-count,
line-count, or import-topology REDs.

## Executable RED:

**No current #196 RED exists.** The strategy implementation is integrated and
its behavior is green; the packet remains a preservation record rather than a
new failing gate. The permanent characterization destination is the existing
production graph:

```text
bun test apps/plasmon/src/os/file-manager/issue-195.characterization.test.ts \
  apps/plasmon/src/os/file-manager/view-strategy.test.ts \
  apps/plasmon/src/os/file-manager/spatial-navigation.test.ts \
  apps/plasmon/src/os/file-manager/render-state.test.ts \
  apps/plasmon/src/os/file-manager/file-entry-state.test.ts \
  apps/plasmon/src/os/file-manager/operation-state.test.ts \
  apps/plasmon/src/os/file-manager/operation-presentation.test.ts
```

Executed against release base `4024add`:

```text
17 passed, 0 failed, 48 expect() calls
```

Canonical RTL strategy guard:

```text
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/rtl/issue-196.test.tsx
```

Result: **1 passed, 0 failed, 9 expect() calls**.

These guards prove the common #195 render/selection boundary, #191 FileEntry
authority, and #173 spatial helper. Sol should add behavior-level strategy
coverage during implementation; do not add a failing test that only checks
for strategy filenames, component counts, CSS selectors, or decomposition
shape.

## Browser boundary:

Browser-only evidence owns real rendered geometry and browser mechanics:

- #173 normal-width List compact columns and ArrowRight geometry;
- responsive Icons/List/Details reflow, overflow, and metadata-column width;
- actual pointer hit testing, pointer capture, focus, and spatial movement when
  RTL cannot faithfully represent them;
- visual thumbnail/object-URL/decode behavior where the browser is authoritative.

The existing `test/e2e/plasmon-list-layout-173.spec.ts` remains the permanent
List geometry destination. New #196 browser checks must be narrowly scoped to
new responsive/view-strategy claims and must not duplicate shared command tests.
The packaged browser session is unavailable in this lane (`local.ndeploy.session.json`
missing), so no browser execution is claimed here. That is an operational
browser block, not a product RED and not a HARNESS GAP.

## Files/authorities Sol may modify:

- integrated or future corrective changes to Icons/Grid, List, and Details
  strategy modules and their pure layout/navigation helpers under
  `apps/plasmon/src/os/file-manager/`;
- thin strategy composition in `FileManagerEntries.tsx` and, if required,
  `FileManager.tsx`, without moving domain authority into either file;
- view-specific styles such as `file-manager.scss` and `list-layout.scss`, only
  where the accepted strategy migration proves the old rules superseded;
- focused Bun tests for strategy/layout policy;
- focused RTL tests for strategy rendering and shared interaction semantics;
- narrowly scoped Playwright geometry tests and their evidence/spec files;
- packet documentation and migration notes for #196.

## Files/authorities Sol must not modify:

- `FsService`, `NodeId`, filesystem core/resource policy, or filesystem schema;
- `AssociationRegistry`, `OpenService`, `FilesystemOpenDispatcher`, or
  shortcut dereference/activation authority;
- `FileManagerCommandBar.tsx`, command models, clipboard, shortcut, import,
  download, Trash/delete, operation-state, operation-presentation, or #65
  lifecycle policy except for typed callback wiring;
- `use-file-manager-directory-state.ts`, `use-file-manager-commands.ts`,
  `use-file-manager-rename.ts`, `use-file-manager-keyboard-adapter.ts`, or
  `use-file-manager-pointer-adapter.ts` as a second decomposition effort;
- `FileEntry.tsx`, `file-entry-state.ts`, `use-file-entry-presentation.ts`,
  `file-icons.ts`, or shared Visual/resource-presentation authority except for
  an explicitly reviewed compatibility input that preserves #191/#190;
- `Desktop`, `desktop/layout.ts`, #192 placement persistence, Process, or
  Windowing;
- #173's accepted List behavior, #189 classifier, #190 presentation, #191
  FileEntry authority, or their permanent tests;
- browser health baselines, packaged runtime/provisioner state, or unrelated
  Shell/Search/Start/native-app surfaces.

## HARNESS GAP: none

The canonical Bun and RTL layers can prove strategy semantics. Playwright is
reserved for the stated geometry/browser boundary; its current inability to
execute is the missing packaged session journal, not a canonical harness gap.
