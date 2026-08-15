# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only the two owner-authorized flaky acceptances below. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Only the following active `@r2-quarantine` tags are authorized:

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Right-snap / snap-preview acceptance | `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — tags `@r2-quarantine @issue-244` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; right snap-preview assertion timed out on the initial attempt and retry | [#244 — Restore quarantined r2 golden-path right-snap preview acceptance](https://github.com/plasmon-cloud/plasmon/issues/244) |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the two tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained in the lane; its single #244 right-snap/snap-preview test is quarantined.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required under the serialized harness; #251 preserves prior failure evidence but is not an active CI quarantine.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — stable loader/local-asset/network-safety coverage remains required; only the #245 readiness/canvas/core-start test is quarantined.
- `test/e2e/plasmon-demo-game.spec.ts` — required under the serialized harness; #250 preserves prior fail-then-pass evidence but is not an active CI quarantine.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

#250 and #251 are evidence-debt Issues only under this policy. They do not authorize `@r2-quarantine` and must not remove their tests from required CI. If serialized exact-head CI passes those tests, update/close the Issues so they do not claim an active required-CI quarantine.

A quarantined test may return to required CI only through its linked restoration Issue. Additional quarantines require new explicit owner authorization.