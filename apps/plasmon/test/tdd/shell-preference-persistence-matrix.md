# Shell preference persistence matrix

| preference | current key/authority | valid values | mutation entry points | reconstruction proof | r2 status |
|---|---|---|---|---|---|
| native pins | `plasmon.shell.preferences.v1` on filesystem root | unique `handlerId` strings | Start pin, task context pin | `preferencesFs.test.ts` | green / #109 |
| Element pins | same | unique `elementId` strings | Start/task context | `preferencesFs.test.ts` | green / #109 |
| theme | same | `plasmon-dark`, `plasmon-midnight` | Settings | validation + persistence tests | green |
| wallpaper | same | `aurora`, `plain` | Settings | validation + persistence tests | green |
| taskbar alignment | **not represented** | intended `center`, `left` | #183 background menu | no proof | RED dependency; add to same accepted store, not localStorage |
| window placement | **not represented** | validated normal geometry keyed by stable app/window placement identity | Window move/resize accepted boundary | #117 RED recomposition | missing |
| Show Desktop snapshot | transient only, not durable | affected WindowIds + prior minimized/focus state | Show Desktop toggle | #185 contract | session-only, not preference |
| Search category/frame geometry | presentation state | viewport-derived | Search tabs | #175/A | browser boundary, not durable |

## Rules

- The filesystem-backed preference store is the only current Shell preference authority.
- Invalid/corrupt values fall back deterministically; a failed save keeps the active in-memory selection and reports an error.
- Window placement must not be hidden in Shell foreground storage. The WindowManager must validate/clamp restored geometry.
- Do not persist focus/MRU or transient drag frames.
