# r2 future browser geometry contract catalog

Exact pixels are intentionally unspecified unless the canonical Issue requires a
measured relation. Lower-layer helpers should own deterministic math first.

| Surface/claim | Owner | Browser required? | Deterministic helper possible? | Current evidence | Proposed test | Tolerance rationale |
|---|---|---:|---:|---|---|---|
| Search frame stable | #175/#193 | yes | state model only | current panel/result CSS | `plasmon-search-geometry-175.red.spec.ts` | subpixel/scrollbar; compare measured transitions |
| Search internal scroll | #175 | yes | result limits pure | CSS overflow + limits | same spec with production corpus | client/scroll dimensions |
| Start containment/navigation surface | #194 | geometry yes; tree no | trail/filter pure | Shell Start panel/source | focused Start browser journey | viewport containment, no fixed magic |
| taskbar menu anchoring | #183/#198 | yes | context clamp pure | `contextPosition` | source/menu rect comparison | adjacency/viewport relation |
| taskbar alignment | #183 | yes | ordering/layout state pure | no preference currently | Center/Left browser journey | relative task positions |
| Native window bounds | #177/#199 | browser complement | `constrainGeometry` | manager tests | repeated open rects | reachable titlebar and viewport |
| Native drag/snap | #43/#199 | yes | snap/resize helpers pure | manager/snap tests | pointer capture/rect/grab offset | pointer continuity, no “moved” only |
| Native resize | #199 | yes for adapter | resizeGeometry pure | pure tests | representative edge/corner | min bounds/cleanup |
| FileManager Icons | #196/#173 | yes | layout math | current FileEntry/CSS | responsive corpus | no overlap/reachability |
| FileManager List | #173/#196 | yes | spatial strategy pure | repaired spec, browser blocked | multi-column/keyboard | measured columns, not exact width |
| FileManager Details | #196 | yes for columns | row/column model pure | details source | metadata association | viewport/overflow relation |

No golden screenshot suite is required. Focused artifacts should capture the
measured rects and only the state necessary to explain a failure.
