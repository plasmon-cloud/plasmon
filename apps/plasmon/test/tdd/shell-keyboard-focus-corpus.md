# Shell keyboard / focus / dismissal corpus

| surface | open pointer | open keyboard | inside keyboard | Escape | outside pointer | activation/focus | cleanup |
|---|---|---|---|---|---|---|---|
| Start | Start button | Ctrl+Escape | ArrowUp/Down/Home/End via `focusRelative`; Enter searches | closes | closes | shortcut/folder owns action; successful file open closes | global listener removed on unmount |
| Search | Search button | Ctrl+Space | result list ArrowUp/Down/Home/End; tabs currently browser buttons | closes | closes | canonical opener; successful open closes | abort/latest controller canceled on query/flyout change |
| taskbar task | pointer click/right click | native button Tab/Enter | browser button semantics | menu-dependent | context menu closes | Process/Windowing action | subscription cleanup |
| tray | tray button | Tab/Enter | tray buttons | closes | closes | Neutron bridge activation | subscription + visibility listener cleanup |
| calendar | clock button | Tab/Enter | previous/next/today buttons | closes | closes | no process authority | timer cleanup |
| settings | footer/context | Tab/Enter | theme/wallpaper controls | closes | closes | Fs-backed save | async save reports notice |
| context menu | contextmenu | keyboard invocation not implemented | menu item Tab/Enter | closes expected | closes | pin/current generic action | menu state cleanup |
| native window | pointer down/titlebar | browser tab/focus; no Shell global shortcut | controls and resize handles | app-specific | WindowManager focus | Process close negotiation | pointer capture/iframe selection cleanup |
| Alt-Tab | N/A | global Alt+Tab | future listbox Arrow cycle | future cancel | N/A | WindowManager MRU | modifier release/capture cleanup |

## Permanent paths

- Existing: `src/os/shell/gate3.test.ts`, `taskbarPresentation.test.ts`, `test/rtl/renderPlasmon.test.tsx`, `src/os/windowing/mru.test.ts`, `NativeWindowManager.test.ts`.
- Promotion gaps: Escape focus return, context menu keyboard focus, Alt-Tab listbox/cancel, and full source-adjacent browser focus assertions.
- Do not add a test-local state machine. Tests must invoke `renderPlasmon()` or existing production interaction helpers.
