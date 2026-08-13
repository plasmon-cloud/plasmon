# Issue #86 — mouse-selectable FileManager diagnostic text

## Disposition

**BROWSER BOUNDARY / RED SPECIFICATION.** Current `.fm-root` applies
`user-select: none` and `.fm-error-banner` has no text-selection override.
Actual selection is browser-owned, so the final gate belongs in Playwright; no
fake RTL selection assertion is staged.

## PRESERVE

- Entry selection, marquee, drag, and rename controls remain non-selectable.
- Error action buttons remain interactive and non-copyable as plain text.
- Error semantics and dismissal/retry behavior remain unchanged.

## CHANGE

- Make error/diagnostic message text selectable without globally enabling text
  selection for draggable resources.
- Audit bounded FileManager diagnostic surfaces (`.fm-error`, inline errors,
  paths/hashes) and change only clearly copy-worthy text.

## UNSPECIFIED

- Exact CSS selector/utility class and whether path/hash fields are all exposed
  as selectable.
- Human/browser fixture used to produce a representative error.

## Existing guards and boundary

`ErrorBanner.tsx`, FileManager RTL interaction tests, Properties tests, and
refactor smoke cover structure and interaction. The missing claim is actual
mouse selection under inherited CSS, which requires a real browser selection
range. Do not convert this into a source-shape test or weaken entry drag rules.

Exact runnable gate: `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts`.
It creates a real FileManager document, induces a user-visible invalid-address
error in the packaged Explorer, selects the diagnostic text with a browser
mouse gesture, asserts `window.getSelection()` contains the message, verifies
no FileEntry enters drag state, then performs an ordinary entry drag and
requires the normal drag state. Missing packaged session/browser crashes are
operational blocks, not expected RED.
