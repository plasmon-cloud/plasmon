# FileManager/Desktop RTL audit

## Real production composition

`test/rtl/renderPlasmon.test.tsx` and `refactorGuardSmoke.test.tsx` use
`createHeadlessPlasmonEnvironment` with real Plasmon services and real React
composition. They are preferred over fake service tests for assembled authority
claims.

Focused `.red` RTL packets use real services where the target behavior is
FileManager import, selection, command, or Explorer projection. Pure model tests
remain appropriate for deterministic selection/refresh/shortcut semantics.

## Findings

- #51 uses real FsService/FileManager and user-event selection; its new Bun gate
  separately protects the canonical helper without claiming the missing command.
- #65 uses real FsService with delayed write/copy wrappers only at the browser
  boundary being controlled; it does not replace filesystem policy or create a
  fake operation manager.
- #182 uses `renderPlasmon` and opens the real Start -> Files native path before
  inspecting actual Explorer Favorites; it no longer compares against a
  test-local hard-coded path list.
- Existing markup-only characterization (e.g. shared command presence) remains
  narrow and is not used as proof of domain behavior.
- No fake service was identified that should be replaced for the existing
  representative RTL suite; small deterministic fakes remain appropriate for
  isolated contract tests.

## Missing semantic work

- #65 production operation state/headless transition coverage after integration;
- #51 actual Send-to-Desktop consumer after implementation;
- #196 per-view keyboard adapter after #195 architecture stabilizes;
- #176 event ownership seam before adding broad context-menu RTL assertions.

Do not multiply RTL tests for common Grid/List/Details semantics; prove shared
selection/activation/rename/commands once and add only view-specific spatial
behavior.
