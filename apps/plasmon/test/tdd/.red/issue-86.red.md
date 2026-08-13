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
