# First-party native-app content chrome matrix

This is a behavior characterization for #112, not a demand for one generic
wrapper. Window title bars remain Windowing-owned; rows below describe content
inside the native window.

| app | root/label | toolbar/menu | loading/empty/error | status/padding | owner/exceptions |
|---|---|---|---|---|---|
| Text | `Text editor` | file controls, Save/Save As, conflict actions | Loading text; choose file; alert | UTF-8, cursor, Saved/Modified | Text editor UX; Monaco runtime is host boundary |
| Markdown | `Markdown editor` | Edit/Split/Preview, Save | Loading Markdown; choose file; alert | UTF-8/Markdown, cursor, state | Markdown owns preview/formatter; shared editor candidate |
| Photos | `Photos` | zoom, fit, actual, Expand | loading bytes; choose image; decode alert | MIME + keyboard help | image pan/zoom and fallback are Photos-owned |
| Video | `Video player` | native controls; external | loading bytes; codec/load alert | keyboard help | browser media owns decode/codec |
| Browser | `Web browser` | address, Go, external | Loading; empty; alert | embedded-site notice | iframe/foreign content owns page body |
| Properties | `* Properties` | PropertiesPanel actions | missing target alert; resource errors | panel-specific | shared FS/association panel owns metadata |
| Explorer | `File Explorer` | navigation, address, view/sort | Loading folder; alert banner | item count/selection | FileManager authority; not a native content template |
| Settings | `Settings` | section controls | storage unavailable status | cards/padding | settings model and Shell callbacks |
| Recycle Bin | `Recycle Bin` | restore/empty | empty/status/error | list-specific | Trash service authority |
| js-dos | `js-dos` | runtime canvas host | loading/starting/error | runtime status | third-party runtime; no `.sys` |
| EmulatorJS | `EmulatorJS` | runtime host | starting/error | runtime status | third-party runtime; no `.sys` |

Common semantic candidates: accessible app root, toolbar when controls exist,
status/alert/live state, tokenized panel/background/border, and consistent
content insets. Legitimate exceptions are runtime canvas/iframe/media,
FileManager's navigation model, and Markdown preview. #112 is **CHARACTERIZATION
READY — NO HONEST STRUCTURAL RED** until a visible common behavior is shown
missing; structural convergence alone is not a RED gate.
