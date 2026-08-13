# FileManager no-policy-duplication oracle

| Command | View must invoke | View must not decide |
|---|---|---|
| Open | `FileManagerOpenAuthority` / `activateFileManagerNode` | handler, association, shortcut or directory policy |
| Rename | shared `renameNode`/FsService command | MIME clearing, NodeId replacement, collision semantics |
| Delete | Trash authority + `deleteFilesystemNodes` | permanent deletion or Trash path |
| Copy/Cut | `FileOperationClipboard` | selection serialization or source mutation |
| Paste | `pasteClipboardCollisionAware` | collision naming or copy/move semantics |
| Shortcut | `createFileManagerShortcut` + shared primitive | target eligibility/metadata serialization |
| Properties | Properties panel/loader with real Fs/Association/Open services | type/MIME or handler inference |
| Open With | OpenWith panel/AssociationRegistry/OpenService | rule priority/default persistence |

The oracle is behavioral: tests should spy/assert canonical authority calls and
outcomes using production contracts. They must not inspect component names or
forbid all local event handlers; view adapters necessarily translate clicks and
keys into shared commands.
