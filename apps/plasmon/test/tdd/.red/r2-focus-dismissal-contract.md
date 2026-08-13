# r2 focus/dismissal contract

## Ownership map

| Surface | Mouse activation | Keyboard activation | Escape | Outside click | Window focus change | Launch/menu dismissal |
|---|---|---|---|---|---|---|
| Desktop | FileManager/root focus | root commands | selection/menu policy | local FileManager | window manager | open authority |
| Start | taskbar/node button | input/list/Enter | Shell closes | Shell capture | no forced close | successful open closes |
| Search | taskbar/result button | input/result/Enter | Shell closes | Shell capture | no forced close | successful activation closes |
| taskbar | item focus/restore | button/chooser | menu closes | menu policy | Process/Windowing | action command |
| taskbar menu | item source/context | menuitem | menu closes | outside menu | source remains | action-specific |
| tray/calendar/settings | taskbar toggle/control | buttons | Shell closes | Shell capture | runtime/settings updates | local surface |
| FileManager | root/entry/menu/dialog | root/entry/command | rename/menu/dialog/selection | local dialog/menu policy | native window authority | open/command authority |
| native window | root/titlebar/control | named controls | pointer cancel/close policy | app content boundary | WindowManager focus/MRU | Process close negotiation |
| editor | Monaco/editor chrome | Monaco commands | document close negotiation | app/window boundary | Process/Windowing | save/discard/cancel |

## Global vs local

Shell owns only Shell-level flyout exclusivity and outside dismissal of markers it
owns. FileManager owns its menus/dialogs. NativeWindow owns pointer capture and
forwards lifecycle requests. Monaco/document owns editor content and dirty-close
state. A global event handler must not dismiss or rewrite foreign Browser/Neutron
content.

## Characterization gaps

Focus return after Escape/outside click, result focus after category changes,
Start folder focus, taskbar menu focus return, and editor/native-window focus
fallback need composed RTL/browser evidence. Do not claim them from `autoFocus`,
CSS classes, or source inspection.
