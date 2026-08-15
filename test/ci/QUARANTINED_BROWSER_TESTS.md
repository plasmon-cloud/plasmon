# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only owner-authorized flaky acceptances below. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Only the following active `@r2-quarantine` tags are authorized:

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Right-snap / snap-preview acceptance | `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — tags `@r2-quarantine @issue-244` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; right snap-preview assertion timed out on the initial attempt and retry | [#244 — Restore quarantined r2 golden-path right-snap preview acceptance](https://github.com/plasmon-cloud/plasmon/issues/244) |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## #279 left-snap restoration

Issue #279 restores `test/e2e/plasmon-golden-path-left-snap.spec.ts` — `packaged Plasmon previews and commits left snap @issue-279` — to required serialized Specialist execution. It carries `@issue-279` and no longer carries `@r2-quarantine`.

The restored acceptance preserves the real rendered titlebar pointer path, production `data-interacting="drag"` session boundary, visible left snap preview, preview geometry, usable-workspace containment, and final `data-window-snap="left"` state. No sleep, timeout increase, retry policy change, geometry weakening, test-only product hook, or Windowing product change is introduced.

The working root-cause hypothesis is cross-journey browser state contamination in the former broad golden-path test rather than a Windowing product defect: the same pointer/drag lifecycle is retained, but #277 isolated this journey into its own spec. #279 must prove that hypothesis with five consecutive clean first-attempt Specialist executions; if the isolated test still fails, preserve the exact evidence and continue investigation rather than weakening the acceptance.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #277 removed only the historical shared left-preview/snap segment while retaining all other golden-path contracts.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — required on this branch under #279, with the full isolated left-preview/snap contract intact.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained in the lane; its single #244 right-snap/snap-preview test remains quarantined until #244 integrates.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required under the serialized harness; #251 preserves prior failure evidence but is not an active CI quarantine.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — stable loader/local-asset/network-safety coverage remains required; only the #245 readiness/canvas/core-start test remains quarantined until #245 integrates.
- `test/e2e/plasmon-demo-game.spec.ts` — required under the serialized harness; #250 preserves prior fail-then-pass evidence but is not an active CI quarantine.
- `test/e2e/plasmon-first-demo.spec.ts` — required.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

#250 and #251 are evidence-debt Issues only under this policy. They do not authorize `@r2-quarantine` and must not remove their tests from required CI.

#277 is the integrated temporary quarantine owner; #279 is the active restoration Issue. Five consecutive clean first-attempt Specialist executions are required before #279 is complete. Additional quarantines require new explicit owner authorization.
