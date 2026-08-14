# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only owner-authorized flaky acceptances. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Only the following active `@r2-quarantine` tag is authorized:

| Required-CI quarantine | Exact spec/test | Existing evidence | Restoration issue |
| --- | --- | --- | --- |
| Right-snap / snap-preview acceptance | `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — tags `@r2-quarantine @issue-244` | PR #241 head `45f2d5f2d832d9e96b6011a538a46fd4d3d317a2`, Packaged Browser run #869 / Actions run `31843462863`, job `94905042903`; right snap-preview assertion timed out on the initial attempt and retry | [#244 — Restore quarantined r2 golden-path right-snap preview acceptance](https://github.com/plasmon-cloud/plasmon/issues/244) |

## Restored required acceptance — #245

`test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — is restored to required Specialist execution under [#245](https://github.com/plasmon-cloud/plasmon/issues/245).

The historical failure was a Node-side polling-deadline race: the 180-second readiness poll timed out with its last sampled state at `loader-ready`, while the immediately captured diagnostic already showed the production runtime at `game-started` / `ready=true` with the required local assets served successfully and no runtime HTTP, failed-request, external-request, page, or console errors. The same attempt then passed on retry.

Restoration keeps the production readiness authority unchanged. The packaged child reports `EJS_onGameStart`; Plasmon translates that real runtime lifecycle event to `data-emulatorjs-phase="game-started"` and `data-emulatorjs-ready="true"`. Required acceptance now waits event-driven on that production phase instead of imposing a second independent 180-second Node polling deadline. The existing overall test safety bound remains unchanged.

The restored required test still proves:

- legal generated NES fixture import through normal Files UI;
- packaged/local EmulatorJS loader, JavaScript, CSS, and core assets;
- production `game-started` runtime initialization;
- visible non-zero canvas;
- no EmulatorJS CDN/external runtime requests;
- no runtime HTTP failures or failed runtime requests;
- no page or console errors.

## Required Specialist inventory

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the tagged #244 test above:

- `test/e2e/plasmon-golden-path.spec.ts` — required.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained in the lane; its single #244 right-snap/snap-preview test is quarantined.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required under the serialized harness; #251 preserves historical failure evidence only and is closed.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — both local-asset/network-safety and restored #245 readiness/canvas/core-start coverage are required.
- `test/e2e/plasmon-demo-game.spec.ts` — required under the serialized harness; #250 preserves historical fail-then-pass evidence only and is closed.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

A quarantined test may return to required CI only through its linked restoration Issue. Additional quarantines require new explicit owner authorization.
