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
filtering, canonical hidden semantics, and visible controls.

Exact packaged gate: `test/e2e/plasmon-hidden-preference-110.spec.ts`. It creates
a dot-hidden resource through the real Desktop/FileManager path, verifies the
resource is absent with the checkbox off, toggles it on, closes/reopens Explorer,
then reloads the Plasmon iframe and verifies the filesystem-backed preference and
resource visibility survive. It must be run only with a healthy packaged
session; a missing session/runtime is an operational browser block, not RED.

Required manual/packaged observations remain: toggle Show Hidden Files, confirm
hidden resources appear/disappear without mutation, reopen FileManager, reload or
recompose Plasmon, and confirm no localStorage access is needed. Dot-hidden
semantics remain owned by the filesystem visibility service.
