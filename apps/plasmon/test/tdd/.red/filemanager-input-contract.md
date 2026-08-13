# FileManager input/accessibility contract matrix

Common semantics should be proven once in the FileManager model/commands, with
RTL proving rendered event wiring and Playwright reserved for actual browser
selection, pointer capture, geometry and context propagation.

| Input/state | Production authority | Expected selection identity | Focus behavior | Browser-only component | Existing evidence | Missing/owning Issue |
|---|---|---|---|---|---|---|
| mouse single click | FileManager selection model | one clicked NodeId | entry focused; prior group collapses on release | hit testing only | model/RTL/golden path | characterization green |
| Ctrl/Cmd click | selection model additive toggle | clicked NodeId added/removed | focus follows clicked entry | modifier dispatch | model/polish tests | green |
| Shift selection | selection model anchor/range | contiguous NodeId range | anchor retained, focus target | modifier dispatch | model tests | green |
| double click | FileManager activation -> open dispatcher | selection target NodeId | focus remains/activation opens | double-click timing/hit test | activation/cross-surface | green |
| Enter activation | keyboard adapter -> canonical open | focused NodeId | focus/selection stable while open request runs | browser key event | keyboard/activation tests | green |
| F2 rename | keyboard adapter + rename presentation | focused NodeId remains target | rename input receives focus/selects accepted range | focus/selection details | polish/component tests | #191 geometry browser |
| Enter rename commit | FsService rename authority | same NodeId, updated name | editor exits only after success | key/blur ordering | model/polish | green |
| Escape rename cancel | rename local presentation | same NodeId/name | prior entry focus restored | key/blur ordering | model/polish | green |
| right click selected item | FileManager context policy | preserve group for group command | context menu receives focus | browser `contextmenu` | gate3/RTL | #176 ownership |
| right click unselected item | FileManager selection then context | clicked NodeId only unless policy says group | menu focus | browser event ordering | gate3/RTL | #176 ownership |
| background right click | FileManager background command surface | selection unchanged or clear per accepted policy | menu focus, background retains no entry focus | browser hit test | renderPlasmon partial | #176 |
| drag selected group | drag model + FsService move/drop | selected NodeIds preserved | pointer capture/preview, then group result | real pointer capture/stack | model and #66 | #92 after #65; #66 browser |
| marquee | rectangle selection model | intersecting NodeIds | FileManager retains focus policy | real coordinates/selection | model tests | browser geometry bounded |
| keyboard navigation | per-view layout policy | focused NodeId changes by spatial strategy | focus/selection follows view geometry | browser rendered order | current universal linear | #173/#196 |
| focus transfer | Shell/Windowing/React adapters | selection identity survives surface focus | active dialog/window receives focus | browser/native focus | refactor smoke | #195/#196 characterization |
| dialog open/close | Properties/Open With/Process authorities | original selection remains | modal focus trap/restore | browser focus trap | Open With/model/RTL | geometry only if needed |
| error/diagnostic text selection | ErrorBanner/FileManager surface | selection IDs unchanged | browser text selection, no entry drag | real browser selection range | semantic alert tests | #86 |

## Shared-input fence

Do not fork open/rename/delete/clipboard/Trash/shortcut semantics by view. Icons,
List, and Details may differ in spatial keyboard movement and layout only. Editable
controls suppress FileManager global shortcuts where the current contract
requires it. Foreign Browser/Neutron content is outside first-party context
interception (#176).
