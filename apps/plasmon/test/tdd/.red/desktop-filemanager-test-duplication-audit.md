# Desktop/FileManager test duplication audit — r2 staging

## Bun/headless coverage to retain

- `src/os/fs/*`: identity, protection, Trash, hidden semantics, shortcut
  serialization/opening, managed-root persistence.
- `src/os/file-manager/model.test.ts` and `file-manager.test.ts`: selection,
  range/marquee, drag validation, rename, clipboard, refresh, properties.
- `create-shortcut.test.tsx`, activation/delete/trash/cross-surface tests:
  canonical command outcomes.
- `file-icons.test.ts`, Visual tests, association tests: classification input,
  presentation composition, fallback and handler matching.
- `explorer/navigation.test.ts`: complete navigation state machine.

These are deterministic and should remain the first-line refactor fence.

## RTL coverage

`test/rtl/renderPlasmon.test.tsx` and `refactorGuardSmoke.test.tsx` prove
assembled React adapter wiring: selection, F2 rename, context menu, Properties,
folder activation, Start/taskbar interactions, and composed authority use.
Existing FileManager component tests prove accessible command/menu/entry states.
Do not duplicate all filesystem semantics in RTL; use it for event routing and
rendered accessibility.

## Playwright/browser-only claims

Retain or add narrow browser evidence only for:

- #190 installed package asset URL/loading and ORB/404 behavior;
- #191/#95 actual Desktop label/rename geometry;
- #66 portal/stacking/pointer hit-testing;
- #86 actual mouse selection under inherited CSS;
- #94 media decode/frame extraction;
- #110 packaged visible preference/reopen journey;
- #176 native context-menu event propagation and foreign-content exemption;
- #108 visible toolbar adapter if deterministic model already passes.

Playwright should not re-prove NodeId rename, shortcut metadata, Trash, hidden
filtering, selection ranges, or canonical open behavior already covered below.

## Redundant or brittle risks

1. Legacy `.fm-entry__thumbnail` `object-fit: cover` is a stale selector while
   current FileEntry uses shared Visual `MediaThumbnail`; do not make a source
   grep the #93 acceptance.
2. Packaged smoke's temporary `/static/plasmon/icons/` allowances are not
   acceptance; they must be removed by #190 rather than copied into new specs.
3. DOM/source-shape tests for FileManager decomposition (#195/#115) would be
   brittle and are intentionally absent.
4. Search/Open/FileManager tests can overlap when proving the same dispatcher;
   keep one cross-surface outcome test and use lower-level unit tests for each
   model, rather than multiplying browser journeys.
5. Navigation browser clicks should remain one adapter proof; all traversal and
   deletion-history cases belong to `ExplorerNavigationModel` tests.

## Missing lower-layer protection

- #189 needs one effective classification precedence and system-app Search
  category guard; current RED packet supplies both.
- #65 needs production operation lifecycle vocabulary before #92 can safely
  add drag move progress.
- #94 needs deterministic bounded eligibility/lifecycle helpers in addition to
  the browser media fixture.
- #86 needs a real selection-range browser assertion; RTL can only assert the
  semantic error surface and controls.
- #176 needs a small first-party event ownership policy test below browser,
  plus one real propagation boundary.

## Recommendation

Prefer Bun/headless for domain and filesystem semantics, RTL for user-event
wiring, and Playwright only for geometry, stacking, text selection, media,
package/runtime asset loading, and native browser event propagation. Do not
remove existing tests from the TDD staging lane; this report is advisory.
