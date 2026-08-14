# Required CI browser quarantines

Emergency r2 CI stability policy removes the entries below from merge-blocking Specialist execution. These are explicit quarantines, not deletions or allow-failure exceptions. The specs remain in the repository for restoration work.

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Golden-path native-window acceptance | `test/e2e/plasmon-golden-path.spec.ts` — `packaged Plasmon boots its real tile and protects native desktop workflows` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; right snap-preview assertion timed out on the initial attempt and retry | [#244 — Restore quarantined r2 golden-path right-snap preview acceptance](https://github.com/plasmon-cloud/plasmon/issues/244) |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` continues to run these clearly stable packaged browser specs as required CI:

- `test/e2e/plasmon-monaco-packaged.spec.ts`
- `test/e2e/plasmon-review-demo.spec.ts`
- `test/e2e/plasmon-demo-game.spec.ts`

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for tests that remain required are not weakened by this quarantine.

A quarantined test may return to required CI only through its linked Issue with deterministic replacement/restoration evidence.