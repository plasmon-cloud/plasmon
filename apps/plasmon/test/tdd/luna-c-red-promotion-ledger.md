# Luna-C RED promotion ledger

| Issue | staging RED | acceptance criterion | permanent destination | implementation PR later | durable GREEN? | stronger equivalent? | promotion gap |
|---|---|---|---|---|---|---|---|
| #64 | not yet staged; runtime save authority absent | close/reopen preserves js-dos changes through FsService | runtime Bun + packaged browser | future runtime owner | no | no | RED seam/owner |
| #67 | browser contract/spec | real Worker startup/communication + edit/save/reopen | `test/e2e/plasmon-monaco-packaged.spec.ts` | future Monaco owner | no | visible editor only (insufficient) | yes |
| #89 | path authority characterization | canonical Program Files path + installed asset failure | package + installed browser | runtime/path owner | partial | package output only | yes |
| #96 | characterization | packaged identity assets resolve for native apps | package/RTL | future packaging owner | partial | structural package test | yes |
| #112 | characterization | common semantic chrome/theme remains coherent | RTL/manual packaged | future Visual/native owner | no | no | no honest structural RED |
| #113 | core matrix | title/language/status/minimap/commands | Bun/RTL + packaged Monaco | Text owner | partial | existing status tests | yes |
| #114 | core matrix | formatter/commands and safe preview | Bun/RTL + packaged Monaco | Markdown owner | partial | mode/render tests | yes |
| #121 | closure audit | explicit fixture through normal installed path | package + Playwright | Testing owner | partial | PR163/package tests | final installed rerun |
| #123 | no gate yet | shared artwork metadata/fallback | Bun/RTL/manual packaged | Visual/Games owner | no | no | needs stable metadata seam |
| #124 | wait #64 | screenshot preview never blocks save | Bun + packaged browser | runtime owner | no | no | dependency |
| #107 | closure audit | every integrated row has truthful evidence | durable acceptance report | Testing | no | #187 smoke only | yes |
| #179 | `.red/issue-179.red.test.ts` | default-off bytes/dirty/save-failure/close semantics | `text/document.test.ts` + RTL | native-app owner | no | current forced autosave (contrary) | yes |
| #180 | browser spec | denied fullscreen expands/restores cleanly | packaged Playwright | Photos owner | helper GREEN only | no | yes |
| #202 | browser RED/spec | no storage bootstrap errors, no allowance | runtime browser + #187 | authorized runtime owner | no | canvas readiness (insufficient) | blocked owner |

`.red` is staging only; each behavior row must be copied/adopted as a normal
regression when implementation begins. No production implementation is part of
this ledger.
