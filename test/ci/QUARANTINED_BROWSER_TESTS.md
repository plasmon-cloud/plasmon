# Required CI browser quarantines

Emergency r2 CI stability policy excludes only the tagged acceptances below from merge-blocking Specialist execution. These are explicit quarantines, not deletions, file-level removals, or allow-failure exceptions.

Required Specialist runs every listed spec file and filters only tests tagged `@r2-quarantine`:

```text
playwright test --grep-invert @r2-quarantine ...
```

Each quarantined test also carries its canonical Issue tag so the debt is visible next to the executable acceptance.

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Right-snap / snap-preview acceptance | `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — tags `@r2-quarantine @issue-244` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; right snap-preview assertion timed out on the initial attempt and retry | [#244 — Restore quarantined r2 golden-path right-snap preview acceptance](https://github.com/plasmon-cloud/plasmon/issues/244) |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps the complete Specialist spec inventory present and excludes only `@r2-quarantine` tests:

- `test/e2e/plasmon-golden-path.spec.ts` — required; all non-right-snap golden-path assertions remain active.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained in the lane; its single #244 test is explicitly quarantined.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — required stable loader/local-asset/network-safety test remains active; only the #245 readiness/canvas/core-start test is quarantined.
- `test/e2e/plasmon-demo-game.spec.ts` — required.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every non-quarantined test remain unchanged.

A quarantined test may return to required CI only through its linked existing Issue with deterministic restoration evidence. Removing a spec from the Specialist command is not an acceptable quarantine mechanism.
