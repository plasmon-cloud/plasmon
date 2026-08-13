# Taskbar / Process / Window truth table

Taskbar state is a projection. `ProcessController` owns process lifecycle, `WindowManager` owns window/focus/minimize state, and `ShellPreferenceStore` owns pin state.

| pin | process | windows | focus/minimize | expected taskbar projection | current evidence |
|---|---|---|---|---|---|
| no | none | none | — | absent | `shell.test.ts` |
| yes | none | none | — | one pinned-only application entry | green |
| no | one | one | focused | one running active entry | green |
| yes | one | one | focused | one pinned active entry | green |
| yes | one | one | unfocused | one pinned running entry | green |
| yes | one | one | minimized | one pinned running, inactive entry; click delegates focus/restore | green |
| no | one | one | minimized | one running inactive entry; click delegates focus/restore | green |
| yes | one | one | restored/focused | active entry | green |
| yes | one | starting | no window yet | launching/busy presentation only; never a second lifecycle authority | green model; async UI remains adapter |
| yes | one | closing | any | closing process omitted from projection; pin survives | current filter; composition regression desired in #81 |
| no | final process closed | none | — | absent | current model |
| yes | final process closed | none | — | pinned-only remains | current model |
| yes | one process, two windows if exposed | two windows | one focused | one app group with two switch targets | #118 RED (current Process is one window/process) |
| yes | two processes same handler | two windows | one focused | one app group, count 2, member targets retained | #118 RED |
| no | two processes same handler | two windows | one focused | one unpinned group while any member runs; disappears after final close | #118 RED |
| yes | Neutron Element `yes` | Kernel-owned | — | running presentation; no Plasmon Process invented | green |
| yes | Neutron Element `no` | Kernel-owned | — | pinned-only presentation | green |
| yes | Neutron Element `unknown` | Kernel-owned | — | explicitly uncertain presentation, never stopped | green |
| no | Neutron Element `yes` | Kernel-owned | — | running unpinned entry may appear while observed running | current model |
| yes/no | multiple Element records same app identity | unavailable | — | preserve only bridge-provided identity; no grouping invented | UNSPECIFIED |

## Identity truth

- **Application identity:** native `handlerId`/`appId`; Element `elementId` and canonical metadata.
- **Process identity:** `ProcessRecord.id`; never replaced by handler id.
- **Window identity:** `WindowState.id`, linked by `processId`/`windowId`.
- **Pin identity:** preference list item (`handlerId` or `elementId`), independent of running state.
- **Group identity:** future native application/handler key; member records remain addressable.

## #187 smoke relationship

The integrated smoke currently proves one real native taskbar lifecycle through open → active → minimize → restore. It does not prove multi-process grouping (#118), durable placement (#117), Close context negotiation (#183), or Show Desktop (#185). No #198 architecture packet is duplicated here.
