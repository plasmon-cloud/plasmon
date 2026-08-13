# Issue #199 — preserve/change/unspecified

## PRESERVE

- NativeWindowManager is the sole geometry/focus/minimize/maximize/snap authority.
- ProcessController owns lifecycle and close negotiation.
- Window identity, z-order, MRU fallback, viewport constraints and restore
  geometry semantics.
- Browser pointer capture, cancel/lost-capture cleanup and iframe suppression.
- Accessible dialog/chrome controls and titlebar reachability.

## CHANGE

- Separate chrome rendering from pointer/resize/snap adapter concerns.
- Keep React as a Humble Object over manager state and browser events.
- Delete superseded adapter code after cutover; no permanent duplicate path.

## UNSPECIFIED

- component/module names;
- exact CSS selectors, sizes, animations and screenshot pixels;
- whether adapter state uses refs/reducer/controller;
- arbitrary source line/component counts;
- new geometry or lifecycle registries.
