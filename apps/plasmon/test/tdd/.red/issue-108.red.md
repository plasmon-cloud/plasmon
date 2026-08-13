# Issue #108 — deterministic FileManager/Explorer navigation

## Disposition

**ALREADY GREEN (implementation already present on current r2 base).** The
production `ExplorerNavigationModel` and `ExplorerHistory` provide NodeId-backed
Back/Forward/Up/direct navigation, same-NodeId no-op suppression, path refresh,
and safe pruning of deleted historical targets. Existing model/headless and
packaged smoke evidence covers the requested behavior.

## Existing evidence

- `src/native-apps/explorer/navigation.ts` and `history.ts` are the canonical
  transient navigation authority.
- `src/native-apps/explorer/navigation.test.ts` covers A→B→C traversal,
  Forward, Up, direct address, rename/move identity, no-op navigation, and
  missing historical targets.
- `test/e2e/plasmon-golden-path.spec.ts` covers visible toolbar/address behavior.

Do not duplicate a RED gate against an implementation already on this branch or
redefine canonical resource opening as navigation.
