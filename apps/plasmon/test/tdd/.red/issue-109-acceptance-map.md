# Issue #109 — shared pin presentation acceptance map

Status: **CHARACTERIZATION READY / WAIT FOR TODAY'S #190 PRESENTATION INTEGRATION**.
No active #109 PR. This is presentation-only and must preserve the already green
FsService pin semantics.

| Criterion | Authority | Observable | Layer | Existing evidence | Missing |
|---|---|---|---|---|---|
| Start pin control uses shared non-emoji presentation | Shell Start + Visual PinIcon | no platform emoji glyph; consistent SVG/shared primitive | RTL/component | `PinIcon` already rendered by current Shell | focused rendered assertion |
| context pin uses same presentation | Shell context + Visual | same semantic icon/state as Start | RTL | current JSX uses PinIcon | cross-surface identity test |
| labels remain exact | `taskbarPinAction` | Pin/Unpin accessible name/title | Bun/RTL | pure label tests | rendered name test |
| pressed state visible semantically | button `aria-pressed` + visual state | state not color-only | RTL | source + pure action test | component assertion |
| persistence unchanged | ShellPreferenceStore | pin survives reconstruction | Bun | preference Fs tests | composed Start/taskbar action |

Do not add a new icon table or alter pin authority. #109 can be implemented
independently of #198 taskbar lifecycle after #190 shared Visual assets are
accepted.
