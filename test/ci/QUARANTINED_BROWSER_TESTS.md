# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only owner-authorized flaky acceptances below. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Only the following active `@r2-quarantine` tags are authorized:

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Shared left-snap preview acceptance | `test/e2e/plasmon-golden-path-left-snap.spec.ts` — `packaged Plasmon previews and commits left snap @issue-277` — tags `@r2-quarantine @issue-277` | Release head `96e44f3de3ca4b7ea9ef591333d176f12eb1fcfb`, Packaged Browser #1035 / Actions run `31860716242`, job `94953529468`; shared #43 left-preview assertion failed first attempt and passed Playwright retry | [#279 — Restore quarantined #277 left snap-preview acceptance to required Specialist CI](https://github.com/plasmon-cloud/plasmon/issues/279) |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## #244 right-snap / snap-preview restoration

Issue #244 restores `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — to required serialized Specialist execution. It carries `@issue-244` and no longer carries `@r2-quarantine`.

The restoration synchronizes the real rendered pointer journey on production `data-interacting="drag"` state before iframe-edge movement and waits for that state to clear after release. It preserves preview geometry, usable-workspace containment, and final WindowManager snap-state assertions without sleeps, timeout inflation, retry-policy changes, weakened assertions, or product hooks.

The prior 5/5 #244 stability sequence belongs to the pre-reconciliation head `f9619cf0f5b79038b1a79452490511de1c40bb14` and remains historical evidence. After the material reconciliation needed to consume the integrated #161 build dependency and current #277 quarantine, fresh exact-head CI/review is required and the Coordinator decides whether the historical stability sequence is sufficient for the block.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #277 removes only the flaky shared #43 left-preview/snap segment while retaining all other golden-path contracts.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — retained in the lane; its single #277 left-preview/snap test is quarantined pending #279 restoration proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — required; #244 restores snapped -> restore -> opposite-edge/right-snap preview and geometry proof.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required under the serialized harness; #251 preserves prior failure evidence but is not an active CI quarantine.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — stable loader/local-asset/network-safety coverage remains required; only the #245 readiness/canvas/core-start test is quarantined until the #245 child restoration is applied.
- `test/e2e/plasmon-demo-game.spec.ts` — required under the serialized harness; #250 preserves prior fail-then-pass evidence but is not an active CI quarantine.
- `test/e2e/plasmon-first-demo.spec.ts` — required.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

#250 and #251 are evidence-debt Issues only under this policy. They do not authorize `@r2-quarantine` and must not remove their tests from required CI.

#277 is the temporary quarantine owner for the isolated left-preview test. #279 is the separate restoration Issue and requires five consecutive clean first-attempt Specialist passes before that quarantine can be removed.

#244 remains the canonical restoration Issue until its fresh effective-head evidence is complete and the Coordinator removes the block. #245 remains independently owned by the stacked child PR. Additional quarantines require new explicit owner authorization.
