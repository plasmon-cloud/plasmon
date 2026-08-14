# Issue #195 — final Luna-A implementor packet

Disposition: **INTEGRATED / ALREADY GREEN — NO IMPLEMENTATION REQUIRED**.
This packet is retained as the merged #195 preservation and authority fence.

Integrated release inspected: `origin/release/0.1.0-r2` at
`5a6c9bb3d46d536c60a41382d5e3754539753dcd`.

PR #213 is merged; no active PR owns #195. Integrated dependencies and the
follow-up #196 strategy migration are present. This packet contains no
production implementation and no structural RED based only on `FileManager.tsx`
size or shape.

## Current production authority

The merged #195 implementation makes `FileManager.tsx` the composition root for
focused React/browser adapters. Directory refresh, commands, rename, keyboard,
pointer, render-state, operation presentation, and typed child render seams are
now explicit production modules. It consumes focused production seams for
activation, clipboard, creation/import, shortcut, delete/Trash, drag decisions,
drop validation, keyboard policy, operation state, rename, preferences,
properties, thumbnails, and shared presentation.

The accepted decomposition boundary is:

```text
React/browser events and rendering
  -> FileManager adapter state/callbacks
  -> existing FileManager models/commands
  -> FsService / NodeId / Trash / Association+Open / Visual / Process authorities
```

#191 is now integrated as the FileEntry pilot. Current FileEntry consumes
`file-entry-state.ts` and `use-file-entry-presentation.ts`; it keeps selection,
rename, coordinates, and resource presentation keyed to NodeId and delegates
artwork/classification to #189/#190 seams. Reuse this behavior pattern without
turning FileEntry into a command or placement authority.

## PRESERVE

### Filesystem and identity

- `FsService` remains the source of filesystem listing, mutation, revisions,
  events, bytes, persistence, and errors.
- `NodeId` remains the identity key for selection, focus, rename, move, copy,
  Trash, shortcuts, desktop positions, and refresh reconciliation.
- `RefreshGate`, `isFsEventRelevant`, and `reconcileSelection` remain the
  authoritative refresh/selection boundary; stale refreshes must not overwrite
  newer state or select a replacement by name/index.

### Opening and application boundaries

- `FileManagerOpenAuthority`/`FilesystemOpenDispatcher` remain the only normal
  resource-open route.
- `AssociationRegistry` and `OpenService` retain handler matching, defaults,
  probe semantics, and dispatch. FileManager only presents Open/Open With and
  forwards the selected NodeId/handler.
- Native Process/Windowing, Neutron bridge, runtime handlers, and caller-owned
  directory navigation remain outside the FileManager command layer.

### Trash and destructive actions

- `deleteFilesystemNodes` and `TrashService` retain protection, Trash metadata,
  stable identity, restore, permanent deletion, empty semantics, and partial
  failure policy. FileManager owns confirmation, selection reconciliation, and
  visible error presentation only.
- Recycle Bin remains the Trash consumer; #195 must not add a second delete or
  restore store.

### Clipboard and operations

- `FileOperationClipboard` remains the clipboard state authority; copy/cut
  selection and collision-aware paste continue to call FsService copy/move.
- Integrated #65 `FileOperationState` is the accepted operation authority for
  import/paste. Its kinds are exactly `import | paste`; statuses are exactly
  `idle | running | completed | failed`; counters/current item/failure records
  and duplicate `begin` protection remain unchanged.
- #92 is a separate RTL RED: drag-originated directory moves currently bypass
  operation state. #195 must preserve that RED and must not quietly implement a
  second operation model or absorb #92's product change.

### Shortcut and presentation boundaries

- `createShortcut`/`createFileManagerShortcut` and `sendFileManagerShortcutToDesktop`
  retain canonical metadata, collision naming, capability checks, stable target
  NodeIds, and destination policy.
- #189 `classifyResource` remains semantic resource/classification authority.
- #190 shared resource presentation remains resolved artwork, fallback,
  shortcut-overlay, sizing, and package-asset authority. FileEntry and future
  render adapters must not grow MIME/type/icon tables.
- #173 compact List behavior and `spatialNeighborId` remain the accepted view
  strategy behavior. #196 is now integrated through `view-strategy.ts` and its
  focused Bun/RTL guards; #195's adapter boundary remains below those strategies
  and does not own view geometry or keyboard policy.
- #192 `reconcileDesktopPositions` remains Desktop placement authority. FileEntry
  receives resolved coordinates; it does not allocate, persist, or reconcile
  placement.

### Interaction and browser ownership

- Selection, keyboard, rename, context-menu, drag/drop, marquee, error, focus,
  and navigation outcomes remain behaviorally unchanged.
- #176 first-party context ownership and #66 drag-preview/stacking boundaries
  remain separate. Pointer capture, `elementFromPoint`, RAF transforms, actual
  focus/selection geometry, file chooser, download, and media decode remain
  browser mechanisms, not new domain authorities.

## CHANGE

The implementor may incrementally:

1. extract resource-surface/FileEntry composition around the integrated #191
   pilot;
2. isolate selection/focus/keyboard event adapters from selection policy;
3. isolate rename editor presentation from `renameNode`/FsService mutation;
4. isolate context-menu rendering from command mapping and canonical commands;
5. isolate pointer capture/RAF/marquee/drag browser adapters from deterministic
   selection/drop/geometry helpers;
6. isolate common error/status/dialog adapters while preserving command results;
7. remove superseded local state/helpers/CSS after each responsibility has a
   real replacement and its indexed guards remain green.

Extraction may change component boundaries and private state freely. It must
continue to invoke existing commands/models/services and keep React as a humble
translation/render layer. A future #195 implementation may improve the #92
adapter only through an explicitly accepted #92 change; this packet does not
authorize that product implementation.

## UNSPECIFIED

The following are intentionally not contracts:

- component names/counts, file/directory layout, private state shape, hook
  structure, helper names/signatures, line counts, import topology, or exact
  CSS class names;
- a target number of FileManager lines or a requirement that every state value
  leave `FileManager.tsx`;
- exact visual spacing, typography, snapshots, DOM nesting, or pixel output;
- a generic job manager, FileManager2, duplicate command stack, feature flag,
  new filesystem repository, second clipboard, second Trash store, or second
  resource classifier;
- Icons/List/Details redesign, Shell/global changes, drag-preview redesign,
  Monaco/runtime behavior, or broad browser health allowances;
- byte progress, ETA, cancellation, or persistence for operations where the
  underlying FsService does not provide those semantics.

## Existing permanent guards

| Authority/behavior | Existing integrated protection |
|---|---|
| FsService / NodeId mutation and identity | `src/os/file-manager/file-manager.test.ts`; `src/os/fs/desktopCore.test.ts`; `test/refactorGuards.test.ts`; `test/fileManagerDelete.test.ts`; `test/trashLifecycle.test.ts` |
| refresh generations/events and selection reconciliation | `src/os/file-manager/file-manager.test.ts`; `.red/issue-195.red.test.ts`; `model.ts` `RefreshGate`, `isFsEventRelevant`, `reconcileSelection` |
| AssociationRegistry / OpenService / canonical opening | `test/fileManagerActivation.test.ts`; `test/resourceOpenCrossSurface.test.ts`; `src/os/file-manager/open-with-gui.test.ts`; `src/os/fs/desktopCore.test.ts` |
| Trash/delete/restore/partial failure | `test/fileManagerDelete.test.ts`; `test/trashLifecycle.test.ts`; `src/os/fs/desktopCore.test.ts`; `src/native-apps/recycle-bin/model.test.ts` |
| clipboard copy/cut/paste/collision | `src/os/file-manager/file-manager.test.ts`; `src/os/file-manager/polish.test.tsx`; `src/os/file-manager/final-gate.test.ts`; `FileOperationClipboard`/`clipboard.ts` |
| Create Shortcut | `src/os/file-manager/create-shortcut.test.tsx`; `src/os/file-manager/gate3.test.tsx`; `src/os/fs/desktopCore.test.ts` |
| Send to Desktop (#51) | `src/os/file-manager/send-to-desktop.test.ts`; `test/rtl/issue-51-send-to-desktop.test.tsx` |
| #65 operation state | `src/os/file-manager/operation-state.test.ts`; `test/rtl/issue-65-operation-progress.test.tsx`; FileManager `operationState` integration. The RTL packet has a current timeout in this detached run and remains #65-owned evidence, not a #195 RED. |
| #173 List behavior | `src/os/file-manager/spatial-navigation.test.ts`; `list-layout.ts`; `test/e2e/plasmon-list-layout-173.spec.ts`; current integrated #173 package/RTL coverage |
| #189 classification | `test/refactor/189/issue-189.test.ts`; FileManager file-icon/property consumers; Search/Photos/Video/Text consumer imports |
| #190 shared presentation | `src/os/visual/issue-190.test.ts`; `src/os/visual/visual.components.test.tsx`; `test/e2e/plasmon-presentation-assets.spec.ts`; FileManager `use-file-entry-presentation.ts` |
| #191 FileEntry pilot | `src/os/file-manager/file-entry-state.test.ts`; `src/os/file-manager/issue-191.characterization.test.ts`; `test/rtl/issue-191.test.tsx`; `test/e2e/plasmon-file-entry-191.spec.ts` |
| #192 Desktop placement | `src/os/desktop/issue-192.test.ts`; `src/os/desktop/layout.test.ts`; `test/e2e/plasmon-desktop-placement-192.spec.ts`; #172 integrated composed gate |
| rename/editor semantics | `src/os/file-manager/file-manager.test.ts`; `polish.test.tsx`; `file-entry-state.test.ts`; #191 RTL characterization |
| drag/drop/marquee deterministic policy | `file-manager.test.ts`; `final-gate.test.ts`; `drag.ts`; `drop-target.ts`; `model.ts` |
| errors/dialogs/preferences/thumbnails | `gate3.test.tsx`; `open-with-gui.test.ts`; `preferences.test.ts`; `polish.test.tsx`; file-icon/thumbnail tests |

## Exact characterization guard still required

`apps/plasmon/test/tdd/.red/issue-195.red.test.ts` is the only new #195
characterization guard staged. It protects the refresh relevance and NodeId
selection-reconciliation seam and passes against the integrated release.

Run it together with the focused FileManager guard set. Do not add a second
copy of existing selection, command, Trash, shortcut, operation, presentation,
List, FileEntry, or placement tests merely to make decomposition visible.

## Current integrated verification

Against release `5a6c9bb`:

```text
bun test apps/plasmon/src/os/file-manager/issue-195.characterization.test.ts \
  apps/plasmon/src/os/file-manager/view-strategy.test.ts \
  apps/plasmon/src/os/file-manager/spatial-navigation.test.ts \
  apps/plasmon/src/os/file-manager/render-state.test.ts \
  apps/plasmon/src/os/file-manager/file-entry-state.test.ts \
  apps/plasmon/src/os/file-manager/operation-state.test.ts \
  apps/plasmon/src/os/file-manager/operation-presentation.test.ts
```

Result: **17 tests, 0 failures, 48 expects**. The integrated #196 RTL strategy
 guard also passed: **1 test, 0 failures, 9 expects** with the canonical Happy
 DOM preload. The historical 47-test characterization result below remains
 archived release evidence.

## Corrective REDs

**No corrective RED belongs to #195 itself.** A broad-component/source-shape
assertion is explicitly invalid. Existing independent REDs remain separate:

- #92 RTL RED — drag operation status is missing after delayed real moves;
- #66/#86/#95 browser boundaries — pointer stacking/text selection/selected-label
  geometry;
- any future behavior defect found during extraction must become the smallest
  canonical Issue/gate for that behavior, not an architecture assertion in #195.

The #195 implementation packet is therefore characterization plus a strict
behavioral fence, not a failing decomposition test.

## Browser boundaries

No new #195 Playwright test is required at packet time. Use existing packaged
coverage for:

- real pointer capture, `elementFromPoint`, drag hit-testing, stacking and
  cleanup (#66);
- actual text selection/drag distinction (#86);
- selected-label/rename-editor geometry (#95/#191);
- compact List rendered geometry and spatial navigation (#173);
- package/runtime asset loading (#190), hidden preference persistence (#110),
  and other owned specialist boundaries.

Do not use Playwright to test deterministic command wiring or because the
component is React. If decomposition changes a genuine browser mechanism, add
only the narrow specialist gate and preserve current health baselines. Local
packaged browser execution remains an operational session concern, not a #195
product RED.

## HARNESS GAP

**None for the current packet.** Bun/headless and RTL express the deterministic
and semantic contracts; Playwright already owns the genuine pointer/geometry
boundaries. If an extraction requires a pointer-capture operation unavailable
in the canonical RTL harness, report a HARNESS GAP rather than simulating
capture with test-local policy.

## Executed integrated characterization

Clean detached worktree at release `82f176a6`:

```text
bun test issue-195.red.test.ts \
  file-manager.test.ts gate3.test.tsx final-gate.test.ts \
  send-to-desktop.test.ts operation-state.test.ts \
  file-entry-state.test.ts issue-191.characterization.test.ts \
  spatial-navigation.test.ts
```

Result: **47 passed, 0 failed, 159 expect() calls**.

Additional integrated dependency authorities:

```text
bun test issue-189.test.ts issue-190.test.ts visual.components.test.tsx \
  issue-192.test.ts layout.test.ts
```

Result: **26 passed, 0 failed, 89 expect() calls**.

The #51 RTL characterization passed. The #191 RTL characterization passed.
The current #65 specialist RTL packet timed out in this detached run; this is
recorded as existing #65 evidence and is not rewritten or attributed to #195.

## Implementor adoption

Adopt this packet and `issue-195.red.test.ts` before extraction. Re-run all
indexed guards, then decompose incrementally. Preserve authority imports and
observable behavior first; remove superseded code only after its replacement
and guards are green. Do not close the product Issue solely because this packet
is adopted.
