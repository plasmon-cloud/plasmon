# #185 acceptance map

| criterion | authority | observable | layer | evidence | final status |
|---|---|---|---|---|---|
| Show Desktop minimizes eligible windows | new WindowManager/Shell command | visible native windows minimized; Process records remain | headless | no command seam; cannot call without inventing API | HARNESS GAP: desired `showDesktop()` / `restoreDesktop()` or equivalent public command |
| restore/toggle only affected windows | same command snapshot | pre-minimized/closed windows never resurrect | headless | no command | HARNESS GAP |
| process survival | ProcessController | records remain during toggle | headless | Process authority available | adoption target after seam |
| taskbar background action | Shell context menu | accessible Show desktop menu item | RTL | `issue-185.red.ui.test.tsx` fails: current menu has Start/Search/Settings only | RTL RED |
| close race | WindowManager/Process | closed window not restored | headless | no command | HARNESS GAP |
| new-window policy | WindowManager | explicit visible/hidden behavior while active | headless | unspecified by canonical issue | contract decision required |
| focus order | WindowManager MRU | affected focus restored coherently | headless | #62 MRU available | command implementation required |

The missing command is a genuine production seam gap, not a reason to build a test-local copy of window state. Browser adoption should be a minimal taskbar semantic click after the deterministic command exists.
