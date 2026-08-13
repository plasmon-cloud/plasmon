# #118 acceptance map

| criterion | authority | observable | layer | current evidence | disposition |
|---|---|---|---|---|---|
| same application is one taskbar group | Process/Window records projected by Shell | one app button/group | Bun | RED: two process records produce two entries | HEADLESS RED |
| all members retain identity | ProcessId + WindowId | chooser rows target exact member | Bun model + RTL | current `NativeTaskbarEntry` has one `process` field | incomplete RED |
| single instance remains simple | Shell projection + WindowManager | click focus/minimize behavior unchanged | Bun | current action tests green | preserve |
| member focus/restore canonical | Process.focus → WindowManager.focus | chosen minimized member restores/focuses | Bun/RTL | current single-task action green | missing grouped action |
| close one/final member | Process.close | count updates; pin survives; unpinned disappears after final | headless composition | #81 is Lane D lifecycle; no grouped model | missing |
| application-level pin | ShellPreferenceStore | pin does not duplicate per process | Bun | pin lists are handler IDs; #109 green | preserve |
| chooser geometry/hit testing | browser adapter | source-adjacent contained chooser | Playwright only if needed | not implemented | browser follow-up |
