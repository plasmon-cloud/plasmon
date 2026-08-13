# Native-app error visibility audit

| surface | visible error? | identity/detail | browser console sole signal? | disposition |
|---|---|---|---|---|
| Text | alert for read/save/conflict | filename/session error | no | #113/#179 preserve |
| Markdown | alert/session error | source/session | no | #114 preserve |
| Photos | loading/error/notice | image title/decode | no | #180 browser |
| Video | error/unsupported | title/MIME/codec | no | browser codec |
| Browser | alert/empty/loading | URL/message | no | iframe browser |
| Settings | unavailable status | reason | no | current model |
| Explorer | banner/dismiss | FS action error | no | A-owned |
| Properties | missing target alert | resource required | no | RTL gap |
| Recycle Bin | banner/alert/status | Trash action | no | current model |
| js-dos | alert detail | runtime error detail | #202 console still additional | #202 |
| EmulatorJS | alert detail/phase | runtime error | no, child reports | #48 browser |
| Review | banner/error state | command/file message | no | #170/#58 package |

Potential defect candidate: Video fullscreen rejection is surfaced as an error
rather than an in-Plasmon fallback, but no canonical #180-equivalent Video issue
was found; report to Coordinator rather than create a competing Issue.
