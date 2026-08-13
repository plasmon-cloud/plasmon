# Shell browser listener audit

Refresh: release `f4ac3b4`. #176 is today's unattended implementation ownership;
its context-menu policy is recorded only as a dependency boundary here.

| Listener | Location | Why | Owning surface | Cleanup | Deterministic policy trapped? | Future owner |
|---|---|---|---|---|---|---|
| `document.visibilitychange` | `useExternalElements` | refresh runtime state when visible | Neutron runtime snapshot | removes exact callback | no; visibility adaptation | Shell runtime adapter |
| `window.focus` | `useExternalElements` | refresh Element runtime | Neutron runtime snapshot | removes exact callback | no | Shell runtime adapter |
| `window.keydown` | Shell effect | Escape/Ctrl shortcuts | Shell transient controller | removes exact callback | yes, transition policy in handler | #197 keyboard adapter + pure policy |
| `document.pointerdown` capture | Shell effect | outside flyout/context dismissal | Shell transient controller | removes exact callback with capture | hit classification/policy partly pure | #197 dismissal adapter; #176 boundary |
| `window.setInterval` | Shell effect | clock refresh | calendar/clock surface | clears timer | no | clock adapter |
| Process/Window subscriptions | `useNativeSnapshots` via `subscribeToNativeShellState` | process/window projection refresh | Process/Windowing | hook cleanup | no | #198/taskbar + Shell projection |
| FsEventSource subscription | Shell effect | Start/Search invalidation | FsService projection | returned unsubscribe | no | #193/#194 controllers |
| Neutron subscription | `useExternalElements` | Element discovery refresh | Neutron bridge | returned unsubscribe | no | runtime adapter |
| `window.resize` | `NativeWindowManager` | constrain window geometry | Windowing authority | manager dispose removes | deterministic manager policy | #199 browser adapter boundary |
| `window.resize` | `WindowLayer.tsx` | update viewport/usable layer | WindowLayer | effect cleanup | likely adaptation only | Windowing composition |
| pointer handlers | React `NativeWindow` | drag/resize/capture/cancel | DOM adapter -> WindowManager | pointer capture/release; cleanup | geometry helpers/manager policy below | #199 |
| `contextmenu` React handler | Shell root | generic/task context policy | Shell/#176 policy | React lifecycle | policy helper pure, ownership currently local | #176 active; do not modify |

## Negative audit

No Shell source listener was found for `visibility`, `message`, or arbitrary
window-wide resize beyond the listed adapters. `DesktopShell.tsx` legacy/gui2
has its own keydown listener and should be audited under legacy removal Issues,
not mixed into #197's active OS contract.

## Required future assertions

- every listener cleanup is exercised by unmount/dispose tests;
- outside dismissal recognizes only Shell-owned markers;
- foreign Browser/Neutron event boundaries are not intercepted;
- policy decisions are pure where deterministic;
- no global context-menu interceptor is added to compensate for #176.
