# Issue #110 packaged persistence contract

Classification: **PACKAGED BROWSER SPEC ONLY**. Deterministic preference and
visibility behavior is green; no active PR owns #110. Browser execution requires
the established #167/#187 packaged session and must not use localStorage.

## Authority

`FileManagerPreferenceStore` stores `FILE_MANAGER_PREFERENCES_KEY` on FsService
root metadata. `FileManagerVisibilityFsService` delegates hidden classification
to FsService via `includeHidden`. Explorer/FileManager owns only presentation.

## Journey

1. Open the installed Plasmon package through the canonical launcher.
2. Reach Explorer through normal Desktop activation.
3. Create/import a dot-hidden resource through the real filesystem path.
4. Confirm `Show Hidden Files` is initially off and the resource is not visible.
5. Toggle the visible control on; assert resource appears without changing NodeId,
   metadata, or protection capabilities.
6. Toggle off; assert it disappears again.
7. Close and reopen Explorer; assert preference and visibility persist.
8. Reload the Plasmon iframe/top-level packaged surface; assert preference is
   reconstructed from FsService-backed state.
9. Confirm no browser-local persistence API is used as the oracle.

## Evidence

Measure visible checkbox state, resource visibility, NodeId, and root preference
metadata through product-visible behavior/authorized test inspection. Start from
strict browser health; no swallowed setup errors, arbitrary sleeps, or conditional
passes. Missing packaged session is **BROWSER BLOCKED**, not product RED.
