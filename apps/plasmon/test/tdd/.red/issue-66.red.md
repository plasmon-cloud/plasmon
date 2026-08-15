# Issue #66 — repaired browser boundary

Disposition: **BROWSER BOUNDARY — FINALIZED TDD RED READY**.

Current integrated source audited at
`8cfb4d68414b271303bd0afefdcac9dc8449c315`. The real browser gate was not
executed because the packaged session/browser runtime was unavailable; this is
an operational block, not a product RED claim. Promotion: **RED NOT YET
CONSUMED**. Product owner: **SOL 1**.

`test/e2e/plasmon-drag-preview-66.red.spec.ts` observes the complete claimed
boundary rather than a preview's existence and CSS alone:

- opens a real native Explorer window;
- selects two real Desktop resources with user interaction;
- starts an actual pointer drag and requires a coherent count-two preview;
- requires preview/window bounding boxes to overlap;
- temporarily hit-tests the preview as an observation probe to prove it is above
the native window without asserting a z-index number;
- restores pointer transparency and requires `elementFromPoint` to reach the
legitimate underlying native window;
- presses Escape and verifies preview/source drag cleanup;
- performs a real drop gesture onto the Explorer FileManager surface and verifies
preview cleanup;
- installs the strict browser-health observer.

The final drop outcome remains owned by FileManager/drop-target/FsService; this
packet does not move Windowing z-order into FileManager. The temporary pointer
probe is restored before the actual hit-test/drop assertions and is not product
behavior. Missing packaged session or browser/runtime failure is an operational block,
not RED. The permanent regression expectation is to retain this Playwright
path unchanged through promotion; it must prove count-two preview, overlap,
stack/hit-test transparency, Escape/drop cleanup, and FileManager-owned drop
outcome.
