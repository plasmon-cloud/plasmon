# Taskbar combination corpus

| pin | processes/windows | focus | minimize | close result | expected projection/action | status |
|---|---|---|---|---|---|---|
| no | none | — | — | — | absent | permanent model |
| yes | none | — | — | — | pinned-only | permanent model |
| yes | one | focused | no | — | active; click minimizes | permanent model |
| yes | one | other focused | no | — | running; click focuses | permanent model |
| yes | one | — | yes | — | running; click restores/focuses | permanent model |
| no | one | focused | no | — | running active; unpinned launch visible | permanent model |
| yes | one | focused | no | prevent/defer | remains active/running | #81 gate + Process tests |
| yes | one | focused | no | allow | pinned-only | #81 gate |
| yes | two same handler | one focused | mixed | one closes | one group, member target retained | #118 RED |
| yes | two same handler | one focused | mixed | all close | pinned-only | #118 future |
| no | two same handler | one focused | mixed | one close | one unpinned group | #118 future |
| yes | native + unknown Element | native focused | — | — | active native + uncertain Element | #81 gate |
| yes | starting/busy | — | — | — | launching badge, no runtime authority | taskbar presentation tests |
| yes | stale Process with missing Window | — | — | — | stale record reconciled; no invalid action target | #81 gate external close |
| any | TaskManager | — | — | — | canonical system app row/task | #184 RED |
| any | visible windows | — | — | — | Show Desktop minimizes eligible only | #185 RED |

No matrix row permits Shell to add/remove Process records or infer Neutron runtime. Group count and member targets are future model fields only after #118 implementation establishes a truthful seam.
