# Native-app accessibility deep audit

| app | root/name | controls/status | resource/error/loading | focus/keyboard/dialog/image/runtime |
|---|---|---|---|---|
| Text | `Text editor` | toolbar, Save, Save As | role status/alert, Modified/Saved | Monaco aria label; close alertdialog |
| Markdown | `Markdown editor` | mode buttons, Save | status/alert, preview | source aria label; close alertdialog |
| Photos | `Photos` | named zoom/fit/fullscreen | status/alert/notice | root tabIndex + arrows; image alt |
| Video | `Video player` | native controls/external | status/error | root keyboard; video native label gap |
| Browser | `Web browser` | labelled address, Go/external | loading/error/empty | iframe title; foreign keyboard boundary |
| Settings | `Settings` | headings/select labels | unavailable status | native forms |
| Explorer | `File Explorer` | toolbars/address/favorites | banner/footer | Ctrl+L/Escape; FileManager semantics |
| Properties | Properties panel | panel action semantics | alert missing resource | wrapper inherits panel |
| Recycle Bin | named table/actions | role table/row/cell, status/alert | loading/empty/error | checkbox/button focus |
| js-dos | DOS game label/status | runtime canvas | loading/alert | canvas keyboard/focus boundary |
| EmulatorJS | iframe `NES game` | host status | loading/alert | iframe keyboard/input boundary |

Current tests are strongest for models/helpers. Missing semantic RTL is staged
as criterion-specific work only where an Issue requires it; no broad redesign or
implementation CSS assertion is proposed.
