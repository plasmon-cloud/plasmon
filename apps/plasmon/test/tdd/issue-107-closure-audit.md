# #107 closure audit / reconciliation

#107 remains OPEN. It is the integrated acceptance ledger, not automatically
closed by #180 or by a green package boot.

| criterion | current evidence | #180 relationship | still missing? |
|---|---|---|---|
| packaged launch/current manifest | #167/#187 installed harness | none | rerun on current release head |
| Text/Markdown edit/save/reopen | `plasmon-monaco-packaged.spec.ts` | none | Worker creation/Firefox health (#67/#89) |
| Photos denied-fullscreen fallback | `photos/fullscreen.test.ts` deterministic helper | #180 owns concrete product path | packaged denied-policy proof |
| Video unsupported codec | `video/media.test.ts` MIME/error policy | none | actual installed browser codec surface |
| js-dos explicit fixture/playable | #121 PR163/package artifacts | none | current final installed fixture journey |
| EmulatorJS runtime | PR142 deterministic/package/browser proof | none | current target browser/package evidence |
| Program Files visible presentation | #57/package structure | none | human/packaged presentation |
| browser health | #187 helper with scoped allowances | #180 must not inherit allowances | current head rerun and allowance reconciliation |
| prior visible baseline | #152 durable report | none | each relevant row retested or blocked explicitly |

The simulated `requestFullscreen()` test is not packaged acceptance. #180 is a
specific Photos behavior gate; #107 remains the umbrella evidence/closure audit.
