# #43 browser pointer-continuity specification

## Preserve / change / unspecified

- **PRESERVE:** `NativeWindowManager` owns geometry, snap side, restore geometry, focus, maximize/minimize, and usable viewport constraints. Existing pure snap tests are characterization, not replacement policy.
- **CHANGE:** only the reopened pointer-continuity defect when dragging a snapped titlebar out of snap.
- **UNSPECIFIED:** quarter/multi-monitor/tiling behavior and exact pixel coordinates.

## Required browser measurement

For each run, record:

1. pointer `clientX/clientY` at titlebar grab;
2. titlebar grab point relative to the pre-drag window rect;
3. pre-unsnap `DOMRect` (including snap side);
4. manager transition / post-unsnap `DOMRect` before and after pointer movement;
5. pointer-relative titlebar offset after the transition;
6. final manager geometry/snap state and pointer capture cleanup.

The meaningful invariant is that the titlebar remains coherently under the pointer: after snap is exited, the pointer-relative grab offset is preserved within a small browser rounding tolerance. `window moved` alone is insufficient.

## Cases

- left snapped → grab away from the edge → drag out;
- right snapped → grab away from the edge → drag out;
- drag near supported top snap affordance, if a top affordance exists (otherwise explicitly skipped, not invented);
- repeated left → unsnap → right → unsnap;
- small viewport where the manager must clamp but preserve the grab relationship as far as geometry permits;
- pointer cancel/lost capture/release cleanup; no stale `user-select`, cursor, iframe pointer-events, capture, timers, or interaction data attribute.

## Browser-health gate

Use the packaged Playwright harness only when available. Fail unexpected page/console/security/runtime errors. Do not claim VERIFIED from parsing or from the current packaged smoke's `data-window-snap` assertion: that smoke proves edge state, not pointer-relative continuity. Current B disposition is **BROWSER SPEC ONLY / BROWSER BLOCKED for execution in this session**.
