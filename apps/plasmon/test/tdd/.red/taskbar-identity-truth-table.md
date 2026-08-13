# Taskbar identity truth table

Refresh: integrated `f4ac3b4`; #198/#183/#118/#109 have no active PR. This is
future preparation and does not touch today's #190 implementation.

| Scenario | Application identity | Pin identity | Process identity | Window identity | Canonical facts | Current projection |
|---|---|---|---|---|---|---|
| pinned not running | native handler/app definition | `pinnedNative` handler id or Element id | none | none | registry + FsService preference | pinned-only entry |
| unpinned running | handler/app definition from Process | absent | ProcessRecord.id | optional `windowId`, fallback process match | Process list | running entry |
| pinned running | same handler | pinned id | ProcessRecord.id | WindowManager state | both preference/process | running/active |
| one app/one process/one window | handler/app | pin optional | one ProcessRecord | one WindowState | Process.windowId and Window.processId | one button |
| one app/multiple processes | same handler | one pin identity | distinct records | distinct/possibly absent windows | Process list; do not collapse lifecycle | current emits process-specific entries |
| one process/multiple windows | same app | one pin | one process | current Process contract has one optional windowId; multi-window vocabulary not proven | WindowManager only | dependency/unknown; no invented grouping |
| focused | handler | unchanged | process | highest non-minimized z / WindowManager focus snapshot | Windowing focus | active state |
| unfocused | handler | unchanged | process | running nonfocused window | Windowing list | running state |
| minimized | handler | unchanged | process | `minimized=true` | Windowing | running, click focuses/restores |
| closed | handler | pin may remain | removed/closing filtered | removed | Process lifecycle | pinned-only or absent |
| background/no window | handler | unchanged | running | absent | Process state only | running; no false active |
| Element unknown runtime | Element id | pinned Elements | external runtime observation | no Plasmon Window authority | Neutron bridge says unknown | uncertain, not stopped |

## Identity rules

- Taskbar grouping key for native applications can only be handler/application
  identity after #118 defines its accepted group model; process/window children
  remain distinct in the chooser.
- A pin is not a process and must survive process closure.
- A process is not a window; closing/minimizing/focusing must delegate to the
  corresponding canonical controller.
- Icons/titles come from native definitions/Visual presentation, not process
  state or DOM order.
