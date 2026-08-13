# Native-window authority map for #199

Refresh: integrated release `f4ac3b4`; no open PR owns #199, #177, or #43.

| Behavior | Actual authority | Browser/React adapter | Current evidence | Future acceptance |
|---|---|---|---|---|
| identity/lifecycle | ProcessController + WindowManager IDs | NativeWindow receives state | Process/window tests | preserve one process/window identity |
| create/default placement | NativeWindowManager `create` + geometry constraints | WindowLayer renders | manager tests | #177 bounded repeated placement |
| x/y/size constraints | `geometry.ts` + manager | pointer move applies preview | geometry/manager tests | no React coordinates |
| z/focus/MRU | NativeWindowManager | root pointer calls `focus` | MRU tests | click/child/taskbar focus composed |
| minimize/maximize/restore | WindowManager | chrome buttons/double click | manager tests | preserve snapped/maximized semantics |
| snap side/state | manager snap maps + `horizontalSnapGeometry` | pointer edge detection in NativeWindow | snap tests | #43 pointer continuity |
| drag | manager move after pointer commit | titlebar pointer capture | browser-only | #43/#199 |
| resize | geometry helper then manager commit | resize handles/capture | pure resize tests | browser edge/corner matrix |
| viewport | WindowLayer ResizeObserver -> manager.setViewport | DOM observer | source only | resize containment |
| title/icon/chrome | NativeWindow JSX/CSS | rendered adapter | limited RTL | #199 chrome accessibility/visual |
| close negotiation | ProcessController via owner callback | close animation/fallback timer | README/source; process tests | close veto/defer/allow |
| iframe suppression | `suspendIframePointerEvents` | browser interaction helper | source only | pointer capture boundary |
| text selection suppression | `suspendDocumentSelection` | browser interaction helper | #86/FileManager separate | drag cleanup |

## Authority rule

The browser adapter can observe pointer coordinates and ask the manager to
commit. It cannot become a second geometry/focus/state authority. `NativeWindow`
may optimistically update DOM during an active pointer interaction, but cancel or
lost capture restores manager state and commit delegates to manager/helper.
