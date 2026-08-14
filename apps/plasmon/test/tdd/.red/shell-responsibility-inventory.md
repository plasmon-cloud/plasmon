# Shell responsibility inventory for #197

Refresh: release `82f176a6`; #197 has no active implementation PR. #176 is
listed as today's unattended implementation ownership and is not modified here.
This is code inspection of `os/shell/Shell.tsx`, not a source-shape RED. The
Luna-A consumer handoff is in `issue-197-luna-a-shell-input-packet.md`.

| Responsibility/state/effect | Current location | Inputs | Outputs | Owning authority | Current tests | Future #197 owner |
|---|---|---|---|---|---|---|
| preference load/save | Shell lines 187–222, `preferences.ts` | FsService/preferences | theme/wallpaper/pins + notices | filesystem-backed preference store | preference tests | preference adapter |
| native snapshot | `useNativeSnapshots` | Process/WindowManager subscriptions | process/window arrays | Process/Windowing | shell/model/window tests | process/window projection adapter |
| external Element snapshot | `useExternalElements` | Neutron bridge, visibility/focus | Element array/error | Neutron bridge | bridge tests | runtime projection adapter |
| taskbar projection | `deriveTaskbarEntries` useMemo | prefs/apps/processes/elements/windows | entries | `shell/model.ts`, Process/Windowing | shell/taskbar tests | #198 taskbar controller |
| tray projection | `deriveTrayEntries` | Elements | tray rows | Neutron declaration | model tests | tray surface adapter |
| Start reconciliation boot | effect calling `reconcileStartMenu` | Fs/native/Elements | root/trail revision/error | #169/startMenu controller | start migration tests | #194 boot boundary |
| Start listing | effect calling `listStartMenuFolder` | current folder/FsEvent revision | items/loading/error | FsService | start folder tests | #194 surface controller |
| Start filter | `filteredStartItems` useMemo | items/query | visible nodes | pure local derivation | no dedicated filter test | #194 view model |
| Start navigation | `openStartNode`, back inline callback | FsNode | trail/flyout/action errors | Start + FilesystemOpenDispatcher | activation tests | #194 controller |
| Start presentation | JSX + `shortcutPresentation` | nodes, prefs, registries | rows/icons/pin buttons | Visual + Shell | limited RTL | #194 rendered adapter |
| Search query/category | state/effects | user input, tab | query/batch/loading/error | Search model + Shell transient | search model tests | #193 surface controller |
| Search source execution | effect `searchShell` | Fs/native/Elements/prefs/events | batch | search.ts | search tests | Search controller |
| Search activation | `openSearchResult` | result kind, authorities | process/FS/Element effects | OpenService/Process/Neutron/FS | activation tests | Search surface command adapter |
| flyout exclusivity | `flyout` + `toggleFlyout` | taskbar/events | one active shell surface | Shell global transient policy | interaction unit tests | #197 transient controller |
| click-away | document capture pointer listener | DOM target | closes flyout/context | browser event adapter | no composed RTL | #197 Shell adapter |
| Escape/Ctrl shortcuts | window keydown listener | keyboard | flyout/context transitions | Shell global policy | no composed focus test | #197 keyboard adapter |
| context policy | `onShellContextMenu` + `resolve...` | DOM ancestry/pointer | context menu state | Shell + taskbar policy | interactions tests | shell context adapter |
| context pin action | inline context JSX | prefs/targets | toggle pin/persist | preference authority | pin tests | #198/#109 consumer |
| action errors/notices | `actionError`, `notice` | open/persist/load failures | alert/status DOM | Shell notification surface | source only | shell notification adapter |
| calendar | clock/calendar state + pure calendar helpers | time/buttons | calendar panel | Shell local transient | calendar tests | calendar surface |
| settings | preference callbacks + JSX | prefs | settings panel | preference store | preference tests | settings surface |
| taskbar activation | `activateTaskbar` | TaskbarEntry, Process/Window | open/focus/minimize | Process/Windowing/Neutron | model tests | #198 command adapter |
| clock interval | effect `setInterval` | now function | clock state | browser timer adapter | no browser test | shell clock adapter |
| children/workspace | `<div data-shell-workspace>` | children | rendered Desktop/apps | Desktop/window composition | smoke | composition root |
| taskbar DOM | bottom JSX | entries/tray/clock | accessible controls | Shell + #198 | browser smoke | #198 surface |
| SR focused-window status | `focusedWindow` + live span | Windowing | live announcement | Windowing state | no RTL assertion | taskbar/window adapter |

## Suspicious domain authority

`startItems`, `searchBatch`, `processes`, `windowStates`, and `elements` are
snapshots, not durable authority. `reconcileStartMenu` is invoked from React,
although the durable policy itself is in `startMenu.ts`; #169 must establish the
boot/controller boundary before #194/#197 move it. No test should treat Shell's
state hooks as the canonical database.
