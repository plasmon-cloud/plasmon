# Issue #196 — final FileManager view-strategy packet

Disposition: **BLOCKED — #195 decomposition cutover not integrated**. The
behavioral contract and readiness packet are complete; do not implement #196
or create a structural RED before #195 exposes the shared adapter/view inputs.

Integrated release: `origin/release/0.1.0-r2` at
`82f176a6f11a163197a270a6c2275dde0f95a2e9`. #173 is integrated; #195 has active
PR #213 and must not be modified from this lane.

## PRESERVE

- One shared FsNode/NodeId resource, selection, focus, rename, activation,
  context, clipboard, Trash, shortcut, Properties/Open With, error and operation
  command contract across Icons, List, and Details.
- FsService, AssociationRegistry/OpenService, TrashService,
  FileOperationClipboard/#65, shortcut commands/#51, #189 classifier, #190
  presentation, and #192 Desktop placement remain external authorities.
- #173 accepted compact List geometry/spatial navigation and #191 FileEntry
  selection/rename/presentation behavior remain green constraints.
- Thumbnails, hidden preference, accessibility names, and stable NodeId identity
  remain intact.

## CHANGE

After #195 exposes the shared adapter contract, make Icons, List, and Details
explicit view strategies. Icons owns spatial icon layout; List owns compact
columns/spatial navigation; Details owns metadata columns. Strategies invoke
shared commands and selection state rather than reimplementing policy. Extract
pure layout/navigation calculations where useful, add RTL semantic strategy
coverage, and use focused browser geometry only for real layout claims. Delete
superseded view CSS/helpers after each strategy migrates.

## UNSPECIFIED

Strategy/component names, input type names, CSS structure, exact dimensions,
column widths, DOM nesting, migration toggle shape, and implementation order.
No view-local command authority, FileManager2, duplicate classifier, or source-
shape/line-count RED.

## Permanent guards to consume

- `src/os/file-manager/spatial-navigation.test.ts` and integrated #173 browser
  gate for rendered compact List behavior.
- `src/os/file-manager/file-entry-state.test.ts`, `issue-191.characterization.test.ts`,
  `test/rtl/issue-191.test.tsx`, and #191 browser geometry.
- `file-manager.test.ts`, `gate3.test.tsx`, `final-gate.test.ts`, `polish.test.tsx`
  for shared selection/rename/drag/drop/error/clipboard semantics.
- `fileManagerActivation.test.ts`, `resourceOpenCrossSurface.test.ts`,
  `create-shortcut.test.tsx`, `send-to-desktop.test.ts`, Trash/delete suites,
  operation-state tests, #189/#190 tests, and #192 layout tests.

## Exact RED / browser boundary

No truthful #196 structural RED exists. The exact dependency is #195's active
implementation/cutover. Corrective behavior remains in canonical Issues (#92,
#95, #173, #175), not #196. Browser boundaries are rendered List/Icons/Details
geometry, spatial hit-testing, focus, and thumbnail/decode behavior only; use
Playwright narrowly. No HARNESS GAP currently exists.

## Likely / forbidden areas

Likely: view strategy components/models, view-specific styles, shared FileEntry
adapter inputs, RTL tests, and bounded geometry specs.

Must not modify FsService, OpenService/AssociationRegistry, Trash, clipboard,
shortcut, classifier, Visual, Desktop placement, Process/Windowing, or #195's
active implementation packet.
