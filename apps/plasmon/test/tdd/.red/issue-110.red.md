# Issue #110 — filesystem-backed Show Hidden Files preference

## Disposition

**BROWSER BOUNDARY / ALREADY IMPLEMENTED.** Deterministic behavior is already
green on this branch: preference persistence uses filesystem root metadata,
visibility delegates canonical `includeHidden`, toggling recomposes FileManager,
and protected resource semantics remain separate. The open Issue's remaining
acceptance is packaged/manual confirmation of the visible checkbox and
restart/reopen journey; no duplicate RED is manufactured for already-green
headless behavior.

## Existing evidence

`preferences.test.ts`, `visibility.ts`, `ManagedFsService`, FileManager/Explorer
composition, and `test/e2e/plasmon-golden-path.spec.ts` protect persistence,
filtering, canonical hidden semantics, and visible controls. Remaining check:
open FileManager View, toggle the checkbox, confirm a known dot-hidden resource
appears/disappears, reconstruct/reopen, and confirm the preference persists.
