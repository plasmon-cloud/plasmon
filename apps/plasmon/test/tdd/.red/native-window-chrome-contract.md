# Native-window chrome and resize contract

## Chrome states

| State | Observable | Layer |
|---|---|---|
| active normal | focused dialog/titlebar, controls reachable | RTL + browser rect |
| inactive normal | inactive visual/accessible state, click raises | RTL/browser |
| maximized | restore control, bounds in usable viewport | Bun + browser |
| snapped | snap marker/state, restore/drag continuity | Bun + browser |
| minimized | hidden/inert semantics and taskbar restoration | RTL/browser |
| closing | close request presentation, veto/defer leaves window alive | Bun/RTL |

## Resize matrix

For each supported direction `n, ne, e, se, s, sw, w, nw`:

- pointer capture belongs to the originating handle;
- width/height never violate accepted per-window minimum;
- geometry remains constrained to viewport and reachable titlebar;
- manager receives final geometry, not a local shadow state;
- pointer cancel/lost capture cleans cursor/selection/iframe suppression;
- unmount cleans active interaction without later committing stale geometry.

Browser tests should use measured deltas and resulting rectangles. Pure tests
already cover resize math; do not duplicate all directions in Playwright unless
pointer capture/DOM routing is the claim.
