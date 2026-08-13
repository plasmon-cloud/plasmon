# Issue #66 — drag preview above window stack

## Disposition

**BROWSER BOUNDARY / RED.** The executable gate performs a real packaged pointer
drag and expects a presentation-only `[data-fm-drag-preview]` layer above normal
windows, with pointer-events disabled and cleanup on release. Current production
moves source entries in their existing stacking context and renders no preview.

Run:

```sh
npx playwright test test/e2e/plasmon-drag-preview-66.red.spec.ts
```

## PRESERVE

- FileManager selection and multi-selection group identity.
- Canonical `directoryDropTargetId`, `moveNodesToDirectory`, and Desktop
  reposition callbacks.
- Windowing owns window z-order; drag preview must not focus/reorder windows.
- Preview is presentation only and cannot become drop authority.

## CHANGE

- Add a top-level/portal-safe presentation layer for active resource drags.
- Represent one or multiple selected resources clearly.
- Keep hit-testing against actual FileManager targets and clean up on release,
  cancel, and unmount.

## UNSPECIFIED

- Portal host/component names, preview artwork, badge text, exact z-index.
- Whether a shared Visual overlay primitive is used.

## Existing guards

`file-manager.test.ts`, `final-gate.test.ts`, `drag.ts`, drop-target tests, and
RTL assembled interaction tests protect selection, drag thresholds, cancellation,
directory validation, and filesystem outcomes. This Playwright gate is limited
to stacking, pointer continuity, and cleanup that Happy DOM cannot prove.
