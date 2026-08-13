# Desktop/FileManager/presentation browser-health allowance map

Source inspected: `test/e2e/plasmon-refactor-smoke.spec.ts` and
`plasmon-browser-health.ts`.

| Allowance | Owner | Applies to | Luna action |
|---|---|---|---|
| Monaco `Canceled` pageerror | #67/#200 | Text/Markdown lifecycle | retain in general #187 baseline |
| sandbox iframe allow-scripts + allow-same-origin warning | Kernel/installed iframe boundary | packaged Shell/native windows | retain; not Desktop/FileManager defect |
| `/static/plasmon/icons/` ORB/aborted requests | #190 | Plasmon-owned Visual assets | remove only when #190 installed asset gate passes; #190 gate omits it |
| Monaco worker fallback warning | #67/#200 | packaged main.js | retain exact path/message |
| opaque-origin worker warning | #67/#200 | packaged main.js | retain exact path/message |
| StorageManager estimate error | #202 | js-dos sandbox | retain; not #190 |
| sandbox storage directory denied | #202 | js-dos sandbox | retain; not #190 |
| js-dos audio sample-rate warning | #202/runtime | js-dos runtime | retain exact path/message |
| GPU ReadPixels warning | browser software rendering | js-dos smoke | retain narrow diagnostic |

## Rules

No new Desktop/FileManager packet may use an empty broad allow list to turn
unrelated known diagnostics into product RED. No packet may broaden these
allowances by message substring alone or remove unrelated canonical allowances
without owning Issue evidence. #171's installed Element gate must separately
observe Neutron icon request failures and must not inherit #190's Plasmon asset
allowance.
