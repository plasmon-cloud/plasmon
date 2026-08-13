# Shell command authority matrix

| user command | Shell entry points | canonical authority | capability / outcome | current status |
|---|---|---|---|---|
| Open Start/Search result | Start, Search, keyboard | `FilesystemOpenDispatcher` / `OpenService` / `Process` / Neutron bridge | success dismisses; failure is visible | #32 integrated |
| Open taskbar native | taskbar button | `ProcessController.open/focus`, `WindowManager.focus/minimize` | launch/focus/minimize | green current |
| Pin/unpin | Start row, task context menu | `ShellPreferenceStore` + `togglePinned` | idempotent logical pin/order | #109 green |
| Close taskbar native | task context menu | `ProcessController.close` | dirty handler may prevent/defer; successful close reconciles | #183 RED |
| Group member switch | grouped taskbar chooser | `ProcessController.focus` → `WindowManager.focus` | member-specific target | #118 RED |
| Show Desktop | taskbar background menu | future `WindowManager` command | minimize eligible windows, preserve process/affected set | #185 RED |
| TaskManager activation | taskbar background menu | system resource/open dispatcher → Process | one canonical `TaskManager.sys` | #184 RED |
| Alt-Tab | global keyboard | `WindowManager.focusSnapshot` + Shell keyboard adapter | cycle/commit/cancel | #63 RED |
| Search cap warning | Search model → Shell | `searchShell` structured result state | warning only for safety/incomplete traversal | #91 RED |
| Taskbar alignment | background menu/settings | `ShellPreferenceStore` | Center/Left durable preference | #183 missing seam |
| Calendar/tray/settings flyout | taskbar buttons | Shell state only; Neutron tray activation delegated | one active flyout and dismissal | current characterized |
| Rename/copy/trash/properties | FileManager/Desktop/Shell context where applicable | shared filesystem command seam | capability/error consistency | #115 Lane A ownership |

No row may create a shadow Process, Window, Search inventory, or durable browser-local preference. A command's visible label may be shared while its domain authority remains separate.
