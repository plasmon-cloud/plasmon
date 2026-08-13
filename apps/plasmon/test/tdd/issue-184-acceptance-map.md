# #184 acceptance map

| criterion | authority | observable | layer | current evidence | disposition |
|---|---|---|---|---|---|
| canonical TaskManager.sys exists | managed system app registry + FS reconciliation | `/System/TaskManager.sys` has system-app metadata | headless | RED: path absent | HEADLESS RED |
| running state direct from Process/Windowing | Process/Window snapshots | one truthful row per process/window | headless | existing list contracts | missing feature |
| Focus/Switch delegates | Process/Windowing | selected row changes canonical focus | headless/RTL | no TaskManager UI | missing |
| Close/End delegates | Process close negotiation | dirty veto survives; successful close reconciles | headless/RTL | #41/#42 process tests | missing consumer |
| stale process disappears | Process reconciliation | closed window removes record/row | headless | controller tests | missing TaskManager projection |
| Search no duplicate Running labels | Search model/Neutron bridge | no TaskManager-created Search state | headless | #174 dependency | WAIT FOR DEPENDENCY |
| taskbar activation | FS OpenDispatcher + Process | background action opens canonical native app | RTL | no menu item | missing |
| no metrics invention | Process contract | no CPU/RAM claims absent authority | review | fields unavailable | UNSPECIFIED |
