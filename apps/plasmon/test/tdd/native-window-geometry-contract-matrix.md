# Native-window geometry contract matrix

| contract | authority | deterministic cases | browser cases | current disposition |
|---|---|---|---|---|
| default width/height/minimums | `NativeWindowManager.create` + `constrainGeometry` | initial bounds, per-window minimums | render accepted result | current green |
| usable viewport | `NativeWindowManager` viewport + reachable titlebar constraints | origin, narrow/short/oversized viewport, resize | rendered controls remain reachable | current green core |
| cascade progression | manager `createdCount` and `cascadeOffset` | sequential opens, close/reopen, exhaustion/wrap | representative rendered rectangles | #177 RED: close/reopen remains clamped at `(1208,688)` |
| deliberate move/resize | manager `move`/`resize`/`setGeometry` | clamping and minimum dimensions | pointer drag/resize and capture | current deterministic green; browser #199 dependency |
| snap left/right | manager snap state + pure horizontal geometry | side geometry, side switch, viewport change | pointer edge detection | #43 manager green |
| unsnap restore | manager `restoreGeometry` | snap → restore, maximize/snap sequence | snapped titlebar drag-out | #43 browser spec only: pointer-relative continuity missing evidence |
| focus/minimize/maximize | manager state/z/MRU | focus minimized, fallback, restore ordering | browser focus/inert | current deterministic green |
| persistence | future Fs-backed placement record validated by manager | missing/corrupt/stale/out-of-range, recomposition | packaged close/reopen | #117 RED: new composition returns default `(64,48)` |
| viewport correction of saved record | manager `constrain` after persistence read | smaller viewport and oversized record | real resized workspace | #117 incomplete |
| multiple windows | Process/Window identity + manager | distinct IDs and member target mapping | taskbar chooser | #118/#198 dependency |
| Show Desktop | future manager command | affected-set snapshot, toggle, close/new window race | minimal taskbar action | #185 RED/spec |
| transient ownership | future explicit owner relation or app-local decision | parent close/minimize/child close | DOM modality only if needed | #119 characterization; no API invented |

## Exact meaningful tolerances

Browser gates must compare `DOMRect` values and pointer-relative offsets, not source constants or CSS class names. Use a small tolerance for browser rounding and assert reachability inequalities (titlebar/control rectangles inside usable workspace), not frozen pixels. #43 must record pointer client coordinate, titlebar grab point, pre-unsnap rect, post-unsnap rect, and resulting pointer-relative titlebar offset for left/right drag-out, repeated snap/unsnap, small viewport, and pointer cleanup.
