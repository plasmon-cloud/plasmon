# Monaco runtime-path duplicate audit

| occurrence | classification | authority/finding |
|---|---|---|
| `build.ts` five `monaco-workers` outputs | canonical packaged adapter | build output contract; #89 must decide final managed projection |
| `text/monacoEnvironment.ts` module-relative worker URL | active packaged adapter | one active Worker resolver; browser proof still missing |
| `packaging.ts` five required output suffixes | canonical package check | structural only, not Worker proof |
| `packaging.test.ts` matching output/input fixtures | test fixture | valid package-shape characterization |
| `os/fs/programFiles.test.ts` `editor.worker.js` | canonical managed-root fixture | filesystem reconciliation test, not Monaco launch |
| docs `Program Files/MonacoEditor` and `FILESYSTEM_DESKTOP_UX_*` | architecture/history | not an active consumer; do not treat as runtime code |
| `test/e2e/*` `/monaco-workers/editor.worker.js` | browser request assertion | current package transport evidence; must evolve with #89 |
| no active `.sys` Monaco resource | required invariant | do not fabricate one |

Search found one active environment installer and one shared editor surface;
there is not currently a duplicated Text and Markdown bootstrap. The genuine
risk is the logical Program Files path versus executable browser transport and
unproved opaque-origin Worker behavior. Any future removal must be proven by
reachability from `src/index.tsx`, package output, and installed request health.
