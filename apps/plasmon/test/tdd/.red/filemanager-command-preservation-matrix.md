# FileManager command preservation matrix

Refresh: integrated `82f176a6`. #51/#65/#190/#191 are integrated and their
accepted seams are consumed as evidence. #115 is Luna-B-owned; this matrix
records its boundary without duplicating its concrete packet.

| Command | Capability predicate | Canonical authority | FileManager responsibility | Entry points | Keyboard | Context menu | Error outcome | Permanent evidence |
|---|---|---|---|---|---|---|---|---|
| Open | resource `open` capability | FileManagerOpenAuthority / dispatcher | pass node, handle visible error | double-click, Enter, Open | Enter | Open | ErrorBanner | `fileManagerActivation.test.ts`, activation/model tests |
| Open With | non-directory, shortcut/association available | AssociationRegistry/OpenWith/OpenService | open dialog, pass selected handler | dialog/menu | dialog keyboard | Open With | dialog error | associations/open-with tests |
| Rename | capability + selected node | FsService/`renameNode` | inline state, commit/cancel, refresh | F2/context | F2/Escape/Enter | Rename | inline error | FileManager/rename tests |
| Cut | selection nonempty | `FileOperationClipboard.cut` | capture selected NodeIds | toolbar/context | Ctrl/Cmd-X | Cut | command error if any | clipboard/model tests |
| Copy | selection nonempty/copy capability | `FileOperationClipboard.copy` | capture selected NodeIds | toolbar/context | Ctrl/Cmd-C | Copy | command error if any | clipboard/model tests |
| Paste | clipboard snapshot exists | `pasteClipboardCollisionAware` + FsService | invoke, refresh, expose integrated #65 status | toolbar/context | Ctrl/Cmd-V | Paste | partial/error visible | operation-state + RTL #65 tests; clipboard tests |
| Delete/Trash | delete capability/confirmation | TrashService via delete helper | confirm, invoke, refresh | toolbar/context | Delete | Delete | partial failure/ErrorBanner | `fileManagerDelete.test.ts`, Trash tests |
| Restore | Trash entry selected | TrashService | Recycle Bin surface owns UI | native Recycle Bin, not ordinary FileManager | surface-specific | surface-specific | visible Trash error | `trashLifecycle.test.ts`; #45 surface |
| Permanent Delete | Trash entry | TrashService permanent delete | Recycle Bin only | surface-specific | surface-specific | surface-specific | visible error | Trash tests; #45 |
| Empty Trash | TrashService | Recycle Bin | confirmation/action surface | Recycle Bin | surface-specific | surface-specific | visible error | Trash tests; #45 |
| Send to Desktop | eligible source, not protected | shared shortcut primitive + FileManager command | destination `/Desktop`, selection/error | context/command | accepted #51 command | context | visible command error | `send-to-desktop.test.ts`, RTL #51 tests |
| Create Shortcut | `canResourceOperation(node,"create-shortcut")` | shared `createShortcut` | eligibility, current dir, select/rename result | toolbar/context | future accepted | context | visible error | `gate3.test.tsx`, #44 audit |
| Properties | properties capability | Properties loader + Association/Open | open dialog with NodeId | context | Escape/dialog | Properties | target-disappeared error | properties tests |
| New File | current directory writable | FsService/create helper | choose kind, select/rename | toolbar/context | future accepted | context | ErrorBanner | `final-gate.test.ts`, gate3 |
| New Folder | current directory writable | FsService/create helper | select/rename | toolbar/context | future accepted | context | ErrorBanner | gate3/model tests |
| Import | input/files + destination | FsService/import helper | file chooser, operation status #65 | toolbar/context | future accepted | context | partial actionable error | #65 active packet |
| Download/export | file/downloadable | FsService bytes + browser download | create download | context | none | Download | visible error | gate3 download tests |
| Refresh | directory readable | FsService/list + RefreshGate | re-list and preserve valid selection | toolbar | none | none | ErrorBanner/retry | FileManager tests |

## Boundary

Capability/policy and mutation stay outside view strategies. #115 may consolidate
command vocabulary, but future #195/#196 must preserve these authority calls and
not introduce view-local Open/Delete/Rename/Clipboard/Trash behavior.
