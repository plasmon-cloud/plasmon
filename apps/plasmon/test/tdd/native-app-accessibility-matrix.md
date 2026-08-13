# Native-app accessibility matrix

| surface | name/root | controls/status | loading/error/dirty | focus/keyboard/dialog |
|---|---|---|---|---|
| Text | Text editor | toolbar; Save; status | role=status; alert; Modified/Saved | editor focus; Ctrl/Cmd+S; close prompt |
| Markdown | Markdown editor | mode buttons; Save; status | status/alert; Modified/Saved | editor/preview; Ctrl/Cmd+S |
| Photos | Photos | named photo controls | loading status; decode alert; notice | arrows, +/-/0/1/F; Escape remains browser/window concern |
| Video | Video player | native controls/external | loading/alert | Space/K/arrows/F |
| Browser | Web browser | labelled address; Go/external | loading/error/empty | form/Escape ownership must remain app-local |
| Properties | Properties app | PropertiesPanel semantics | alert for absent target | normal dialog/window close |
| Explorer | File Explorer | navigation/view tools | loading/alert/status | Ctrl/Cmd+L, Escape address |
| Settings | Settings | headings/selects | status unavailable | native form semantics |
| runtimes | DOS game/EmulatorJS | host label/status | alert/status, not canvas-only proof | runtime input and close belong host/window |

This is a gap map, not broad accessibility redesign. Stage RED only where a
canonical Issue requires it (#113/#114/#180/#202); use semantic RTL where
Happy DOM is truthful and packaged browser for iframe/worker/media/focus.
