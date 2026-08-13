# Native-app failure-state matrix

| app/runtime | loading | ready | empty | missing/unsupported/read | save/API/runtime failure | recovery/close |
|---|---|---|---|---|---|---|
| Text | Loading text | Monaco/status | choose text | alert | save error/conflict remains dirty | #41/#42 prompt |
| Markdown | Loading Markdown | editor+preview | choose Markdown | alert/sanitized preview | formatter/save must preserve text | shared dirty close |
| Photos | Loading image bytes | image/zoom | choose image | decode/unsupported alert | fullscreen notice (#180) | restore view/window |
| Video | Loading bytes | native controls | no target | codec/load alert | fullscreen rejection currently visible error | close cleanup |
| Browser | loading target/iframe | embedded page | no address | target/iframe alert | foreign site denied | external action |
| Properties | panel load | metadata | missing target alert | stat error surface | action error from panel | close normal |
| Settings | storage calculation | cards | unavailable status | settings availability status | callback/persistence error | close normal |
| Explorer | folder loading | FileManager | empty folder | banner alert | command progress/error | navigation retry |
| Recycle Bin | list | empty/rows | explicit empty text | Trash errors | action error | close normal |
| js-dos | loading/starting | real ready/canvas | no bundle is error | empty/read error | #202 storage errors | player stop cleanup |
| EmulatorJS | loading/starting | real runtime | no ROM is error | invalid ROM/error | runtime error | host teardown |

Audit finding: required app paths generally expose status/alert rather than
blank content. Remaining browser-only risks are #67/#89 Worker health, #180
fullscreen fallback, media codec acceptance, and #202 storage bootstrap. These
are not silently converted to GREEN by headless tests.
