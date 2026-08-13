# #121 r2 closure audit

PR163 is merged and package tests currently prove the deterministic legal
`PlasmonDemo.jsdos` bytes plus URL-safe runtime assets. The packaged smoke also
checks the fixture URL. The remaining acceptance claim is the complete installed
journey, so this is **CLOSURE AUDIT**, not a new fixture implementation.

Required evidence: explicit fixture flag only; unflagged boot has no game seed;
fixture is authored/redistribution-safe; normal bootstrap creates a stable
`/Games/Plasmon Demo.jsdos` node; FileManager resolves it; AssociationRegistry
selects generic js-dos; OpenService creates runtime process/window; actual
installed player/canvas reaches ready; no game-name dispatcher, fake `.sys`, or
remote asset dependency.

Existing evidence: `test/package.test.ts`, `test/e2e/plasmon-demo-game.spec.ts`,
`test/e2e/plasmon-refactor-smoke.spec.ts`, `src/games/demoFixtureBundle.ts`.
Re-run on the current release head and attach a strict browser-health result
before closing #121. Do not restore the retired unconditional Doom seed.
