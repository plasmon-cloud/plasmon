# Shell flyout transition matrix

`none`, `start`, `search`, `tray`, `calendar`, `settings` are current flyout
states. Context menu is orthogonal but opening any flyout clears it. “Focus” is
marked `CHARACTERIZE` where source does not establish a durable accepted target.

| Current | open Start | open Search | open tray | open calendar | open settings | outside pointer | Escape | activation | window focus change | taskbar click |
|---|---|---|---|---|---|---|---|---|---|---|
| none | Start; Start input autofocus | Search; Search input autofocus | Tray; characterize focus | Calendar; characterize focus | Settings; characterize focus | none | none | canonical action | no flyout change; Element refresh | selected toggle opens |
| Start | close Start | Search; close Start | Tray; close Start | Calendar; close Start | Settings; close Start | close Start | close Start | folder stays Start; successful launch closes | no direct change | Start toggles close; other toggles replace |
| Search | Start; close Search | close Search | Tray; close Search | Calendar; close Search | Settings; close Search | close Search | close Search | successful result closes; failure visible | no direct change | Search toggles close; other toggles replace |
| tray | Start; close tray | Search; close tray | close tray | Calendar; close tray | Settings; close tray | close tray | close tray | Element launch closes on success | no direct change | tray toggles close; other toggles replace |
| calendar | Start; close calendar | Search; close calendar | Tray; close calendar | close calendar | Settings; close calendar | close calendar | close calendar | Today/month changes only calendar | no direct change | calendar toggles close; other toggles replace |
| settings | Start; close settings | Search; close settings | Tray; close settings | Calendar; close settings | close settings | close settings | close settings | preference persists; settings stays | no direct change | settings has no dedicated toggle; taskbar other toggle replaces |

## Orthogonal context menu

- Any shell-owned context event opens generic/native-task/element-task menu and
  clears active flyout.
- Outside pointer closes context menu.
- Escape closes context menu before any remaining flyout according to accepted
  event priority; current Shell clears both in one handler.
- A context menu action either changes pin preference or opens a flyout and then
  closes the menu.

## Required acceptance layering

Pure policy tests cover transitions represented by `toggleFlyout` and
`shouldDismissShellFlyout`; RTL covers actual button/keyboard/pointer semantics;
Playwright is reserved for focus/geometry/hit testing. No transition row requires
future component names.
