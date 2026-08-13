# Monaco/Text/Markdown document authority map

Refresh: integrated release `f4ac3b4`; no active #200 PR and no other native-app
lane ownership observed in the open PR list.

| Concern | Text | Markdown | Actual authority | Shared-host boundary |
|---|---|---|---|---|
| resource identity | `target.nodeId` | `target.nodeId` | FsService/NodeId | host receives stable semantic key |
| live document session | `useDocumentSession` -> DocumentSession | same | `text/document.ts` | host never owns session |
| save/dirty/conflict | DocumentSession | same | FsService + DocumentSession | host emits edits/ready only |
| close negotiation | `useDocumentCloseProtection` + DocumentCloseModel | same | ProcessController + document close model | host must not complete Process close |
| model identity | `createEditorSurfaceModelOwner` | same surface | Monaco global registry, per-surface owner | host owns exact model instance only |
| Monaco instance | `MonacoEditorSurface` | same component | browser Monaco API | host lifecycle adapter |
| language | `editorLanguageForName(snapshot.name)` | literal `markdown` today | future #178 canonical language hint | host consumes a language input; no extension table |
| worker configuration | `installMonacoEnvironment` | imported through shared surface | `monacoEnvironment.ts` + build assets | #89 path authority, host bootstrap |
| editor commands | Text toolbar/keyboard helpers | Markdown toolbar/mode controls | app-specific UI plus Monaco commands | host exposes generic command hook only if accepted |
| Markdown preview | absent | `MarkdownPreview`/sanitizer | Markdown app | outside host |
| app chrome/status | Text editor chrome | Markdown mode/preview/status | each native app/shared chrome helpers | outside host |
| save/reopen | Text normal process route | Markdown normal process route | OpenService/Process/FsService | browser proves package boundary only |

## Authority rules

- Host receives a document snapshot/value and reports edits; it does not read or
  write FsService directly.
- Host model disposal is by exact owned model instance, never global URI lookup
  that could dispose another live surface.
- Text and Markdown share document/close semantics but retain app-specific chrome
  and Markdown preview behavior.
- Language is a canonical input after #178, not a host-owned global table.
- Worker path/bootstrap is a browser runtime concern and must not become a
  document/session fallback.
