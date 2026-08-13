# FileManager selection/focus preservation map

Refresh: integrated release `f4ac3b4`. #191 active; #173 active unattended
ownership. This is behavior protection for #195/#196, not a structural test.

| Behavior | Production seam | Existing guard | Browser/RTL gap | Future owner |
|---|---|---|---|---|
| single selection | `decideEntryPointerSelection`/`selectNode` | `file-manager.test.ts`, gate3/model tests | rendered pointer semantics | #195 |
| Ctrl/Cmd toggle | additive selection decision | model tests | RTL user-event modifier | #195 |
| Shift range | ordered IDs + range decision | model tests if supported | RTL selected state | #195 |
| empty-space clear | background pointer / `clearSelection` | model tests | RTL/browser pointer distinction | #195 |
| root keyboard focus | FileManager `tabIndex=0`, focus on entry pointer | source/RTL smoke | focus owner after refresh | #195 |
| arrows | `handleKeyDown` ordered IDs | `gate3` keyboard command only; spatial view behavior incomplete | RTL per view | #196/#173 |
| Enter | canonical `openNode` | activation tests | RTL rendered result | #195 |
| F2/rename | `fileManagerKeyboardCommand`, inline rename | rename/model tests | RTL editor focus/bounds | #195/#95 |
| Delete | keyboard command -> Trash helper | delete tests | RTL command semantics | #195 |
| context-menu selection | context handler selects clicked node then opens menu | gate3 tests | RTL menu focus/selection | #195 |
| drag selected set | `finishEntryDragGesture`, selection ids | drag/model tests | browser pointer/capture #66 boundary | #195; #66 active |
| marquee | `captureMarqueeRectangles`, `marqueeSelection` | model tests | real rect/hit testing | #195 |
| view switch | presentation prop + same NodeIds | FileManager component tests | geometry/focus persistence | #196 |
| refresh reconciliation | `RefreshGate` + `reconcileSelection` | FileManager tests | visible focus after async refresh | #195 |
| hidden preference | Fs-backed pref + visibility facade | preference/visibility tests | packaged #110 | #110 |

## Preservation rules

Selection stores NodeIds, not array positions or names. Refresh must remove
missing IDs without selecting a different resource accidentally. View strategies
may alter spatial navigation but must share selection, activation, rename,
clipboard, Trash, Properties and Open With policy. Do not duplicate #66 drag
preview or #176 context ownership packets.
