# js-dos lifecycle coverage

| phase | evidence | gap |
|---|---|---|
| association/no `.sys` | `jsdos.test.ts`, headless dispatcher | permanent |
| package assets/URL mirror | package tests, runtime tests | permanent structural |
| FsNode bytes/error | host source, headless open | no host-level read failure UI test |
| script/style load | runtime source/package | browser |
| keyboard capability | `jsdos.test.ts` | permanent helper |
| canvas/player readiness | `plasmon-demo-game.spec.ts`, smoke | browser, canvas not storage health |
| audio/GPU diagnostics | #187 scoped allowance | issue-specific health |
| storage bootstrap | #202 exact errors | blocked product/browser |
| progress export/import | #64 absent | full RED / future owner |
| stop/revoke/reopen | source cleanup + fixture browser | browser teardown/reopen gap |
| repeated/two-game launch | process/runtime tests partly; no browser | browser isolation gap |
