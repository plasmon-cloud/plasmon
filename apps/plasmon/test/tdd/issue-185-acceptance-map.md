# #185 acceptance map

| criterion | authority | observable | layer | current evidence | disposition |
|---|---|---|---|---|---|
| Show Desktop minimizes eligible windows | WindowManager command | visible windows become minimized; processes remain | Bun | no command | HEADLESS RED to add after command seam |
| restore/toggle affects only command set | WindowManager snapshot | pre-minimized/closed windows never resurrect | Bun | no snapshot command | missing |
| no process destruction | ProcessController | process records remain during action | headless | Process authority available | missing consumer |
| taskbar background exposes action | Shell context menu | menu item reachable from background | RTL | RED gate absent item | RTL RED |
| new window while active | WindowManager command state | new window policy explicit (visible or included) | Bun | unspecified | contract decision required |
| closed meanwhile | Process/Window authority | closed window is not restored | Bun | no command | missing |
| focus order restoration | WindowManager MRU | prior focused eligible window restored coherently | Bun | #62 MRU exists | missing |
