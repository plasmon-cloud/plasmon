# #89 worker route table

| Monaco label | current `monacoWorkerFile` | required canonical route | current result |
|---|---|---|---|
| editor/editorWorkerService | `editor.worker.js` | `/System/Program Files/MonacoEditor/editor.worker.js` transport | RED: current `./monaco-workers/` |
| typescript/javascript | `ts.worker.js` | canonical Program Files route | RED |
| json | `json.worker.js` | canonical Program Files route | RED |
| css/scss/less | `css.worker.js` | canonical Program Files route | RED |
| html/handlebars/razor | `html.worker.js` | canonical Program Files route | RED |
| unknown/plaintext | editor worker fallback | canonical editor route | RED |

Routing names are currently deterministic and covered by Bun. The path authority
is not: build emits top-level `monaco-workers`, and `new URL` in
`monacoEnvironment.ts` resolves there. This is an executable deterministic RED
plus a genuine installed Worker browser remainder.
