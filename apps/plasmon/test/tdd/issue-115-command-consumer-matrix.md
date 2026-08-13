# Issue #115 command / consumer matrix

B-side inventory only. The canonical #115 packet is Lane-A-owned; this records Shell/taskbar consumers and does not create a competing command API.

| command identity | capability predicate | canonical authority | consumer 1 | consumer 2 | outcome/error vocabulary | current duplication |
|---|---|---|---|---|---|---|
| `open` | node/resource is openable | `FilesystemOpenDispatcher` / `OpenService` / Process / Neutron | Start | Search | success closes surface; error `Could not open …` | Shell has separate callbacks for Start/Search |
| `open-native` | registered handler | Process/OpenService | Search native result | taskbar launch | `ProcessId` or visible failure | taskbar uses `executeNativeTaskbarAction`; Search has inline branch |
| `open-element` | bridge exposes Element | NeutronBridge | taskbar Element | tray/Search | bridge error surfaced; runtime refresh failure does not block open | `openElement` and `openExternalElement` paths |
| `pin-toggle` | valid app/Element identity | ShellPreferenceStore | Start shortcut row | taskbar context menu | Pin/Unpin labels; non-destructive save error | same helper currently, two UI callbacks |
| `focus-or-minimize` | native task has Process/window | WindowManager + Process | taskbar click | future grouped chooser | focus/restore/minimize | taskbar model action only; no shared command object |
| `close-process` | running Process | ProcessController.close | #183 task menu | TaskManager #184 | allow/prevent/defer; dirty app veto preserved | no Shell path currently |
| `show-desktop` | eligible native windows | WindowManager future command | #183 background menu | future keyboard command | affected set minimized/restored | absent |
| `properties` | resource supports properties | FileManager/Properties native app | FileManager context | Desktop context | canonical open/error | FileManager owns presentation; #115 decides if command is retained |
| `trash` | ResourcePolicy permits move to trash | TrashService | FileManager context | Desktop context | ordered successes/failures | Lane-A/filesystem authority; Shell should not duplicate |
| `rename` | resource capability | FsService command seam | FileManager context | Desktop context | validation/error | currently surface callbacks |
| `copy/cut/paste` | clipboard and resource policy | filesystem/file-manager command seam | FileManager keyboard/context | Desktop context | operation result/progress | currently surface-specific |

## B decision

The only honest B RED today is an externally visible outcome inconsistency. Identical labels or duplicate callbacks are not enough. #183 `Close` is a real missing outcome but belongs to #183 until the shared command scope is accepted. No structural “all consumers call function X” RED is staged.
