# Media native-app failure matrix v2

| failure | Photos | Video | expected common contract | layer |
|---|---|---|---|---|
| Fs read failure | error alert/no image | error alert/no player | preserve identity and close | Bun/RTL |
| missing bytes/empty | image decode/error | video load/error | no blank success | Bun/browser |
| unsupported MIME | explicit unsupported | codec explanation | actionable alert | Bun/RTL |
| decode error | `onError` message | code 3 message | no unhandled rejection | browser |
| stale NodeId | source effect catch | resolve catch | no save/open replacement | headless |
| oversized policy | no current explicit bound | no current bound | do not invent limit | discovery |
| close during load | cleanup lease/effect | cleanup lease/effect | no stale state update | browser |
| repeated open | release old lease | release old lease | no URL leak | browser |
