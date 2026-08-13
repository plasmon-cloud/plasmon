# Shell / Windowing authority map

| concern | canonical authority | Shell may project/dispatch | forbidden B shortcut | evidence |
|---|---|---|---|---|
| native process identity/lifecycle | `ProcessController` / `NativeProcessController` | taskbar application projection; launch/focus/close intent | Shell running-app map | `src/os/process/process.test.ts`; #72 model |
| native window identity, geometry, z, focus, minimize, maximize, snap | `WindowManager` / `NativeWindowManager` | taskbar active/minimized presentation; browser pointer intent | Shell geometry/localStorage coordinates | `NativeWindowManager.test.ts`, `snap.test.ts` |
| window MRU | `WindowManager.focusSnapshot()` | Alt-Tab selection | taskbar order, DOM order, process array order | #62 tests; #63 RED |
| native close negotiation | `ProcessController.close()` and registered app handler | Close menu intent | direct DOM removal or `windows.close()` from Shell | #41/#42 contract; #183 RED |
| native app identity | `NativeAppRegistry` / definitions | names/icons/handler id | taskbar-local icon/catalog identity | taskbar model and native definitions |
| filesystem resource identity/opening | `FsService`, `FilesystemOpenDispatcher`, associations | Start/Search/task activation | shell filename switch table | #32/#70 composition |
| Neutron installation/runtime | `NeutronBridge` | uncertain running projection and activation | inferred/fabricated Process records | `ExternalElement.running`, bridge tests |
| taskbar pin preference | `ShellPreferenceStore` over filesystem root metadata | pin/unpin presentation and order | foreground `localStorage` | `preferencesFs.test.ts` |
| taskbar alignment preference | **missing**; must extend accepted Shell preference authority | future Center/Left projection | ad hoc foreground storage | #183 RED/spec only |
| Start visible inventory | `/System/Start Menu` plus reconciliation | folder/flyout presentation | Shell app catalog | Start reconciliation tests |
| Search result model | `searchShell` and canonical classification | tabs/result rendering | Shell-owned result database | #91 RED; #174 dependency |
| visual tokens/icons | shared Visual assets/primitives | consume presentation | duplicate emoji/local semantic icon map | #109 green; #111 audit |
| transient/dialog ownership | **not yet contracted** | app-local overlays until contract exists | invented parent/child WindowManager records | #119 characterization |
| Show Desktop affected set | **missing canonical command**; intended WindowManager | invoke/toggle action | Shell copy of all WindowState | #185 RED/spec |

## Stable identity separation

`NodeId`, `appId`/`handlerId`, `ProcessId`, `WindowId`, pin identity, and Neutron `elementId` remain distinct. A taskbar group may key its presentation by native application/handler identity, but each member switch/close target must retain its `ProcessId` and associated `WindowId`. A pin is never a process record. An application projection is never evidence that a Neutron Element is running.

## Preservation / change / unspecified

- **PRESERVE:** WindowManager geometry and snap authority; Process lifecycle and close negotiation; filesystem-backed Shell preferences; shared Visual identity; Neutron runtime uncertainty.
- **CHANGE:** missing #63 Alt-Tab dispatch, #91 cap/safety distinction, #117 durable placement, #118 grouping, #183 Close/alignment/menu actions, #184 TaskManager resource, #185 Show Desktop.
- **UNSPECIFIED:** transient parent/child semantics (#119), Neutron control beyond exposed bridge methods, performance metrics in TaskManager, multi-monitor/workspace placement.
