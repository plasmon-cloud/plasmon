# #202 adaptation seam options

1. **Runtime capability detection:** detect unavailable estimate/directory APIs
   before optional bootstrap; skip only non-authoritative capability. Requires
   exact bundle behavior confirmation and no fake result.
2. **Host-owned narrow adapter:** expose a runtime capability object to the
   construction boundary only if js-dos supports injection. It must not become
   a Plasmon storage authority.
3. **Graceful degradation:** let player run without optional browser storage and
   report non-durable runtime state. #64 still requires FsService save bridge.
4. **Upstream/vendor patch:** only with version/source/license audit, deterministic
   package test and browser proof; never a blind string replacement.

Evaluate each against Chromium/Firefox, worker/WASM startup, close, and save
impact. The future owner must not choose based on silencing console output.
