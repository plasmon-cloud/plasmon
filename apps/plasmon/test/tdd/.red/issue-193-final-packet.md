# Issue #193 — final Search reconstruction implementor packet

Disposition: **FINAL IMPLEMENTOR PACKET READY / ACTIVE IMPLEMENTATION OWNERSHIP — DO NOT TOUCH**.

Integrated release: `origin/release/0.1.0-r2` at
`5a6c9bb3d46d536c60a41382d5e3754539753dcd`. PR #219
(`agent/refactor-193-search-surface`) is open and owns implementation; this
packet remains the accepted preservation and authority fence.

## Prerequisites

- #174 native `.sys` projection is complete/no implementation required;
  consume `searchShell`'s canonical de-duplicated result.
- #189 classification and #190 shared presentation are integrated.
- #175 stable Search frame geometry remains the focused browser prerequisite;
  do not characterize its known defect as a golden behavior.
- #187 health/smoke guardrails remain the packaged baseline.

## PRESERVE

- `searchFilesystem`/`searchShell` remain Search source and result authorities;
  no second app catalog or UI-local classifier.
- `classifyResource` remains resource category/type authority; #174's canonical
  `.sys` identity and de-duplication remain unchanged.
- `activateSearchFilesystemResult` and canonical filesystem/Open/Process/Neutron
  routes remain activation authority.
- Query cancellation/latest-request behavior from `LatestSearchController`,
  category filtering, result limits/warnings, hidden policy, and unknown runtime
  uncertainty remain truthful.
- Search/Start/taskbar flyout exclusivity, Escape/outside dismissal, focus, and
  keyboard semantics remain Shell-global contracts.
- #190 Visual/resource presentation is consumed; Search must not map MIME/icons.

## CHANGE

Extract a focused Search rendered surface/view model from `Shell.tsx` that
receives canonical result batches and shell-owned transient callbacks. Isolate
query/category/loading/empty/warning/error/result-focus state where a real seam
exists, keep React as event/render translation, and delete superseded Search
JSX/effects/styles after cutover.

The surface may expose stable accessible result buttons, loading/status/alert
states, keyboard navigation, click-away, Escape, and activation busy/error
states. It must not own filesystem reconciliation, application discovery,
classification, or process launching.

## UNSPECIFIED

Component/file names, private state shape, exact DOM nesting, CSS values, query
algorithm, result IDs beyond stable production identity, focus auto-focus policy,
and exact frame dimensions are unspecified except where #175 defines measured
geometry. No Search2, duplicate source, line-count, or screenshot-only RED.

## Existing permanent guards to consume

- `apps/plasmon/src/os/shell/search-projection.test.ts`
- `apps/plasmon/src/os/shell/search-projection.test.ts` / search model tests
- `apps/plasmon/src/os/shell/shell.test.ts`
- `apps/plasmon/src/os/shell/activation.test.ts`
- `apps/plasmon/test/resourceOpenCrossSurface.test.ts`
- `apps/plasmon/test/refactorGuards.test.ts`
- `apps/plasmon/test/rtl/renderPlasmon.test.tsx`
- `test/e2e/plasmon-search-geometry-175.red.spec.ts`
- packaged refactor smoke/health and #190 presentation asset checks

The integrated #174 RED characterization remains green: **3 passed, 13 expects**.
The #189/#190/#192 dependency authority suite remains the accepted integrated
evidence. No #193 corrective RED is added while PR #219 owns implementation.

## Exact REDs and browser boundary

No implementation-independent structural RED belongs to #193. The only current
corrective browser boundary is #175 measured frame geometry/internal scrolling;
its browser execution is separate from deterministic Search state. If extraction
regresses keyboard/focus/dismissal/activation, add the smallest RTL gate for that
behavior, not a Search architecture assertion.

No HARNESS GAP exists for the current deterministic/RTL contract. A genuine
browser focus/hit-testing limitation must be reported rather than simulated.

## Areas likely modified / must not modify

Likely: `Shell.tsx` Search composition, a focused Search surface/model, Search
styles/docs, RTL tests, and narrow browser geometry adapter files.

Must not modify: `resourcePolicy.ts`, `search.ts` authority semantics, filesystem
open/activation, `AssociationRegistry`, `OpenService`, Process/Windowing,
Neutron installation/discovery, Trash, or #174/#189/#190 tests to weaken them.
