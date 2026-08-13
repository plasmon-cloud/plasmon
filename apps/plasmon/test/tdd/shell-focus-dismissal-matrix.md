# Shell focus / dismissal matrix

| surface | pointer open | keyboard open | outside click | Escape | launch/activation | focus change | another flyout |
|---|---|---|---|---|---|---|---|
| Start | toggle button opens; click inside remains | Ctrl+Escape toggles | closes | closes | successful open closes; folder navigation stays | active shell owner remains | previous closes, new opens |
| Search | toggle button opens | Ctrl+Space opens | closes | closes | successful result activation closes | input owns focus while open | previous closes, new opens |
| taskbar menu | right-click task source | keyboard context invocation when supported | closes | closes | action delegates Process/Windowing | menu action returns focus according to browser semantics | closes before flyout |
| tray | tray button opens | no dedicated global shortcut currently | closes | closes | Neutron Element activation delegates bridge | Shell remains projection | closes before new flyout |
| calendar | clock opens | no dedicated global shortcut currently | closes | closes | month controls remain owned | clock button is source | closes before new flyout |
| settings | Start footer/context action opens | reachable through Start keyboard | closes | closes | preference write remains active even if persistence reports error | settings control owns focus | closes before new flyout |
| context menu | pointer context event opens adjacent to source | keyboard context invocation is future contract | closes | closes | pin/Close/Show Desktop/TaskManager delegate canonical command | action closes menu | closes before another flyout |
| native window | pointer down focuses WindowManager | browser tab/focus adapter | not a Shell flyout; WindowManager owns | app-specific/browser behavior | close uses Process negotiation | focus is WindowManager authority | Shell flyout must not copy window state |

## Existing seam evidence

`shouldDismissShellFlyout()` proves inside-flyout, toggle, context-menu and outside-pointer cases. Existing RTL proves Start open/Escape and taskbar focus/minimize/restore. #197 may consume this matrix but B does not duplicate its future packet. Alt-Tab, true taskbar menu focus, transient modality, and browser pointer capture remain missing evidence.
