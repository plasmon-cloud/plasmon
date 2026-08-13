# Issue #196 — responsive geometry corpus

Future browser geometry matrix (not a golden screenshot suite):

- 320×480
- 480×640
- 800×600
- 1024×768
- 1280×720
- 1440×900

For each view strategy, record meaningful behavior:

| View | Minimum meaningful assertions |
|---|---|
| Icons | columns/items remain reachable; no item overlaps; scroll/containment follows view contract |
| List | compact rows remain readable; columns/rows do not overlap; spatial navigation target is visible |
| Details | metadata columns remain associated with row; horizontal overflow policy is explicit; row focus remains usable |
| Desktop | positioned entries remain within workspace; marquee/drop target geometry remains meaningful |

Use actual `getBoundingClientRect`, scroll dimensions and keyboard/pointer
outcomes. Tolerances should account for browser rounding and responsive layout;
exact theme pixels and CSS constants are intentionally unspecified. Shared
selection/activation commands are tested once below browser.

Finalize after #195 establishes the surviving FileEntry/view adapter seam and
#173's accepted List behavior is integrated.
