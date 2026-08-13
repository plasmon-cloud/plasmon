# #183 acceptance map

| contract | authority | observable | layer | current evidence | disposition |
|---|---|---|---|---|---|
| item/background menu source adjacency + viewport containment | Shell event + browser layout | DOMRect menu is adjacent/contained at left/right edges | Playwright | current fixed-position style is not measured | BROWSER SPEC ONLY |
| running Close action | ProcessController.close | menu action negotiates through Process; no direct DOM removal | RTL/headless | RED gate finds only Pin | VERIFIED CORE RED |
| dirty veto/defer | Process close handler (#41/#42) | rejected close leaves process/window/taskbar | headless + RTL | Process tests green; no taskbar menu path | incomplete |
| Center/Left alignment | Shell preference authority | visible deterministic task order/alignment | Bun + RTL | no preference field/control | missing |
| durable alignment | ShellPreferenceStore | survives reconstruction | Bun | current store supports existing prefs only | missing |
| pin preservation | Shell preference | item pin behavior unchanged | existing Bun/RTL | #109 green | preserve |
| no shadow lifecycle authority | Process/Windowing | projection reconciles after close | headless | current model consumes snapshots | preserve |
