# Installed and browser acceptance

`test/e2e/` contains repository Playwright specs and shared helpers for claims that require installed package output, Neutron/PocketIC lifecycle, real browser rendering, workers, pointer/focus behavior, or other browser-owned boundaries.

The Plasmon local deployment manifest and provisioner are the source of truth for the installed Plasmon fixture. Read the relevant app or repository testing document before running a spec; lower-layer semantics belong in workspace tests and should not be duplicated here.
