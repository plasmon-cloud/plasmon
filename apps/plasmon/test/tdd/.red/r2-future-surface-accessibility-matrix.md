# r2 future surface accessibility matrix

This matrix records existing/required observable semantics; roles must be
validated against current accepted markup before implementation changes.

| Surface | Root role | Item role/name | Selected/current | Focus owner | Keyboard entry | Escape | Context menu | Loading/empty/error/disabled |
|---|---|---|---|---|---|---|---|---|
| Search | region `Search` | result button: title + subtitle/category | tabs `aria-selected` | input initially; result after navigation | taskbar/input/Arrow/Home/End/Enter | Shell dismissal | Shell context only where owned | status, empty text, alert, busy item |
| Start | section/menu `Start menu` | node button: name + kind/target | current folder represented by trail; no invented selected state | Start input/list | taskbar/Arrow/Home/End/Enter | dismissal | pin/menu policy | status, empty text, alert, disabled Back/preferences |
| taskbar | navigation `Taskbar` | button: app + state | native active `aria-pressed`; verify current semantics | clicked item/focus fallback | Tab/Enter/Space | active menu/surface | menuitem | busy/uncertain labels; disabled launching |
| taskbar menus | menu | menuitem accessible label | none or checked pin state | menu/focus return | keyboard invocation/arrows/Enter | close menu | nested policy only if accepted | unavailable Close omitted; errors visible |
| native window | dialog | titlebar controls named Minimize/Maximize/Restore/Close | active state via dialog/focus semantics | root/titlebar/control | pointer + keyboard controls | close/interaction policy | app content owns its menu | minimized inert/hidden, close veto visible |
| FileManager views | listbox Files | FileEntry semantic name/type | selected/focused state must be observable, not CSS class | root/entry/rename editor | arrows/Enter/Escape/commands | rename/menu/dialog/selection | menu/menuitem | loading/empty/ErrorBanner/disabled commands |
| Monaco host | editor surface | editor accessible label Text content/Markdown source | Monaco selection/focus | editor | editor native keyboard | app close negotiation | outside host | loading/ready/error, document state outside host |

Current gaps include Search result focus characterization, Start selected/current
semantics, taskbar grouped child announcement (#118), and composed dialog focus
return. Link each to its canonical Issue rather than silently changing it.
