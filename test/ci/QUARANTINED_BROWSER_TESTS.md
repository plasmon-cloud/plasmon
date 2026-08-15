# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only the remaining owner-authorized flaky acceptance below. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Only the following active `@r2-quarantine` tag is authorized:

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; 180 s readiness timeout followed by a passing Playwright retry | [#245 — Restore quarantined r2 EmulatorJS packaged readiness acceptance](https://github.com/plasmon-cloud/plasmon/issues/245) |

## #244 right-snap / snap-preview restoration

Issue #244 restores `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — to required serialized Specialist execution. It carries `@issue-244` and no longer carries `@r2-quarantine`.

The preserved failure was a browser pointer/session synchronization problem rather than evidence of a Windowing geometry/state defect:

- the quarantined right-snap acceptance moved the top-level Playwright pointer toward an iframe edge immediately after `page.mouse.down()`;
- PR #252 characterization added an observation of the production `data-interacting="drag"` state before edge movement and its Packaged Browser run #901 completed green;
- PR #253 later reproduced the same boundary in the still-required golden-path left snap: the preview assertion failed before passing on retry while the #245 EmulatorJS acceptance itself passed;
- the #244 restoration therefore synchronizes both authoritative snap journeys on the real rendered drag-session state before edge movement and waits for that state to clear after release;
- no WindowManager product semantics, geometry authority, timeout values, sleeps, retry policy, or fail-on-flaky behavior are changed.

The #244 restoration PR must still obtain clean exact-head required CI before integration; this document describes the proposed executable policy on that branch.

## Required Specialist inventory

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the explicitly tagged #245 readiness acceptance:

- `test/e2e/plasmon-golden-path.spec.ts` — required, including synchronized left-edge snap-preview proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — required; #244 restores snapped -> restore -> opposite-edge/right-snap preview and geometry proof.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required under the serialized harness; #251 preserves prior failure evidence but is not an active CI quarantine.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — stable loader/local-asset/network-safety coverage remains required; only the #245 readiness/canvas/core-start test remains quarantined on this branch until #245 integrates.
- `test/e2e/plasmon-demo-game.spec.ts` — required under the serialized harness; #250 was deterministically repaired and integrated by PR #263 after the serialized harness reproduced its activation race, and it carries no active quarantine.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

#250 is resolved and integrated by PR #263; its historical fail-then-pass evidence remains useful, but the production acceptance is required and no quarantine is authorized. #251 remains historical evidence debt under the serialized policy and likewise does not authorize `@r2-quarantine`.

#244 remains the canonical restoration Issue until its required exact-head evidence is clean and the restoration is integrated. #245 remains the only active quarantine represented by this branch's inventory policy. Additional quarantines require new explicit owner authorization.
