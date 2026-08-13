# Text document-session exhaustive matrix

| case | owner | permanent/current test | gap/Issue | layer |
|---|---|---|---|---|
| existing/new/open | Fs/OpenService/Session | document tests + package e2e | package worker health #67 | Bun/package |
| edit/save/Ctrl+S | Session/Text adapter | document + packaged e2e | RTL keyboard/save semantics | Bun/RTL |
| save failure/conflict | Session | document tests | none | Bun |
| dirty Save/Discard/Cancel | DocumentCloseModel/Process | documentClose tests | #79 composed headless | Bun/headless |
| rename/move open | Fs NodeId/Session | partial checkExternalChange | explicit mutation corpus | Bun |
| deleted/Trash/restored | Fs/Session | no app-level test | stale-resource matrix | Bun/RTL |
| two Text docs/surfaces | Process/Monaco owner | process/monacoAdapter tests | composed multi-window | headless/browser |
| reopen/recomposition | Fs/session | save/reopen test | package restart | Bun/package |
| language/MIME rename | classifier/Text | #189/#178 tests | #113 consumer | Bun/RTL |
| autosave OFF | Session | `.red/issue-179` | intentional current RED | Bun |
| autosave ON future | Session preference | close tests cover timer primitive | #179 future branch | Bun/RTL |

No browser DOM is needed for byte/dirty semantics. Monaco focus/Worker and
visible close prompt remain browser/RTL boundaries.
