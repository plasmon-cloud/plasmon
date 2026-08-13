# #89 package file inventory

| logical asset | current build output | expected #89 output | package test | browser claim |
|---|---|---|---|---|
| editor worker | `dist/web/monaco-workers/editor.worker.js` | `dist/web/System/Program Files/MonacoEditor/editor.worker.js` or accepted URL-safe mirror | `packaging.test.ts` | actual Worker request |
| JSON worker | top-level json worker | canonical route | package guard | language Worker |
| CSS worker | top-level css worker | canonical route | package guard | language Worker |
| HTML worker | top-level html worker | canonical route | package guard | language Worker |
| TS worker | top-level ts worker | canonical route | package guard | JS/TS language Worker |
| Monaco CSS/main | main bundle + CSS | unchanged except runtime route | package guard | editor ready only insufficient |

Program Files filesystem tests characterize managed identity but do not create
actual package files. Package mirror may be required by Neutron URL serving; it
must be documented as transport, not installation authority.
