# Taskbar authority audit

| Derivation | Current source | Canonical? | Future owner | Evidence/gap |
|---|---|---|---|---|
| pinned native order | `ShellPreferences.pinnedNative` | yes, FsService-backed | #198 preference projection | preference Fs tests |
| pinned Element order | `pinnedElements` | yes, FsService-backed | #198 | preference Fs tests |
| installed native metadata | `NativeAppRegistry.list()` | yes | native registry | model tests |
| native running | `ProcessRecord.state` | yes | Process | taskbar tests |
| native process grouping | `deriveTaskbarEntries` by handler then process | partial current behavior | #118 group projection | current test explicitly preserves distinct entries |
| focused | WindowState highest non-minimized z / Windowing focus | yes | Windowing | model tests; should consume `focusSnapshot` where accepted |
| minimized | WindowState.minimized | yes | Windowing | model tests |
| labels/icons | NativeAppDefinition or Process fallback; Elements snapshot | partial | Visual + application registry | #109/#190 convergence |
| launch/focus/minimize | `executeNativeTaskbarAction` | yes delegation | Process/Windowing | model tests |
| Close | absent from current taskbar context policy | missing | #183 via Process.close | canonical close negotiation tests |
| context menu placement | Shell `contextPosition`, fixed width/height | partial | #183 browser adapter | no real item adjacency proof |
| alignment | no preference field/current hardcoded layout | missing | #183 preference authority | no accepted persistent model |
| pin/unpin | `togglePinned` + preference store | yes | #109 presentation only | pin label tests |
| group counts | absent | missing | #118 | no accepted model |
| taskbar order | pin order then Process/input order | deterministic but process order source unspecified | #198 | pure model evidence |
| Element runtime status | Neutron `ExternalElement.running` | yes but uncertain | Neutron bridge | uncertainty tests |
| taskbar accessibility | labels/state in `TaskbarPresentation`, `aria-pressed` native | partial | #198 | no RTL surface contract |

No second running-app registry is justified. Any future group projection should
be a pure function over pins, app registry, Process records, Window states, and
accepted Shell preferences.
