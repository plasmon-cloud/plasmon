# Issue #66 — repaired browser boundary

Disposition: **BROWSER SPEC ONLY / VERIFIED CORE RED PENDING EXECUTION**.

`test/e2e/plasmon-drag-preview-66.red.spec.ts` now observes the complete claimed
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
behavior. Missing packaged session or browser/runtime failure is an operational
block, not RED.
