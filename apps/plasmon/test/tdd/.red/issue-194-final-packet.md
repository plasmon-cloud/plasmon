# Issue #194 — final Start surface reconstruction packet

Disposition: **BLOCKED — #169 Start reconciliation RED must be resolved/accepted
before final Start cutover**. The characterization and implementation boundary
are ready; no production implementation is made here.

Integrated release: `origin/release/0.1.0-r2` at
`82f176a6f11a163197a270a6c2275dde0f95a2e9`.

## Prerequisite

#169 currently has a real headless RED for malformed `Accessories` sibling
reconciliation. #194 must consume the accepted #169 result/controller and must
not trigger reconciliation from React render/effect lifecycle. #189/#190 are
integrated dependencies.

## PRESERVE

- `/System/Start Menu` is the sole durable visible authority.
- `reconcileStartMenu`/#169 owns managed defaults, provenance, collision,
  migration, customization, rename/move/delete preservation, and seed ledger.
- FsService/NodeId owns tree identity/listing/mutation; canonical shortcut and
  open/activation authorities own launch behavior.
- Association/OpenService, Neutron bridge, Process/Windowing, shared #189/#190
  presentation, Shell flyout exclusivity, focus, Escape, outside dismissal, and
  taskbar toggles remain external authorities.

## CHANGE

Extract a focused Start surface over an explicit root/folder/trail/loading/
empty/error view state. It should consume production reconciliation/health and
FsService snapshots through props/controllers, render accessible items, preserve
navigation/focus/keyboard/launch semantics, and remove Start-specific JSX,
effects, and styles from `Shell.tsx` after cutover.

## UNSPECIFIED

Component names, tree model names, private state shape, exact folder layout,
CSS/pixel values, retry wording, auto-focus policy, and Start2/parallel migration
mechanics. No second inventory/catalog or render-triggered durable writes.

## Permanent guards to consume

- `src/os/shell/startMenuSystemMigration.test.ts`
- `apps/plasmon/test/managedRootBootstrap.test.ts`
- `src/os/fs/desktopCore.test.ts`
- `src/os/shell/activation.test.ts`
- `apps/plasmon/test/fileManagerActivation.test.ts`
- `apps/plasmon/test/refactorGuards.test.ts`
- `apps/plasmon/test/rtl/renderPlasmon.test.tsx`
- Shell `gate3`, preferences, subscription, and taskbar projection tests
- #169 RED and its eventual permanent reconciliation tests

## Exact RED / browser boundary

No new #194 structural RED is truthful while #169 is unresolved. The current
#169 headless RED is the exact dependency gate. Start semantic RTL tests should
be added/adopted once #169's accepted boundary exists; real panel geometry,
focus/hit-testing, and stable frame behavior belong to the bounded #175 browser
boundary. No HARNESS GAP currently exists.

## Likely / forbidden areas

Likely: `Shell.tsx` Start composition, a focused Start surface/view model,
Start styles/docs, and RTL/browser adapter tests.

Must not modify: `startMenu.ts` reconciliation policy before #169 ownership,
FsService schema, `/Apps` installation authority, Search, Trash, Process/
Windowing, or shared presentation/classification authorities.
