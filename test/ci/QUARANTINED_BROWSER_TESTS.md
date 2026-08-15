# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and runs serialized with Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

**No active `@r2-quarantine` is authorized on this stacked #245 restoration branch.**

Quarantine remains test-level and explicit policy. It is never a spec deletion, file-level removal, retry exception, allow-failure policy, arbitrary timeout increase, or substitute for repairing a deterministic acceptance boundary.

## Restored required acceptance — #244

`test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — is restored to required Specialist execution under [#244](https://github.com/plasmon-cloud/plasmon/issues/244).

The historical instability was browser pointer/session synchronization rather than a demonstrated Windowing geometry/state defect. The acceptance previously issued top-level Playwright `page.mouse.down()` and immediately moved toward an iframe edge, allowing edge movement to race production drag-session establishment. Characterization PR #252 observed production `data-interacting="drag"` before edge movement and completed Packaged Browser #901 green.

The restored path waits for that production drag state before edge movement and waits for it to clear after release while retaining the real titlebar pointer path, snap-preview geometry, dragged-window reachability, and WindowManager-authoritative committed snap assertions. The shared required golden path uses the same synchronization for its left-edge snap boundary.

No WindowManager product semantics, sleeps, timeout increases, retry policy, or test-only product hooks are changed.

## Restored required acceptance — #245

`test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — is restored to required Specialist execution under [#245](https://github.com/plasmon-cloud/plasmon/issues/245).

The historical failure was a Node-side polling-deadline race: the last 180-second `expect.poll` sample still observed `loader-ready`, while the diagnostic captured immediately after rejection already showed the production runtime at `game-started` / `ready=true`; retry then passed. Required packaged resources were available and the failure carried no runtime HTTP, failed-request, unexpected external-request, page, or console error evidence.

Restoration keeps the production readiness authority unchanged. The packaged child reports the real EmulatorJS `EJS_onGameStart` lifecycle event; Plasmon exposes that as `data-emulatorjs-phase="game-started"` and `data-emulatorjs-ready="true"`. Required acceptance waits event-driven on that existing production phase with a `MutationObserver`, resolves immediately if already started, rejects on the production error phase, and retains the existing overall Playwright safety bound.

The restored test continues to prove:

- legal generated NES fixture import through the normal Files UI;
- packaged/local EmulatorJS loader, JavaScript, CSS, and core assets;
- real production `game-started` initialization;
- visible non-zero runtime canvas;
- no unexpected EmulatorJS CDN/external runtime requests;
- no runtime HTTP failures or failed runtime requests;
- no page or console errors;
- normal runtime teardown.

## #250 integrated demo-game stabilization

`test/e2e/plasmon-demo-game.spec.ts` remains required. The serialized Specialist harness reproduced its historical fail-then-pass activation race, satisfying #250's reopen condition. PR #263 repaired the test deterministically by using FileManager's production select + Enter activation path and asserting committed selection before activation. PR #263 passed all required CI and is integrated into `release/0.1.0-r2`.

Historical #250 evidence remains useful for regression diagnosis, but it authorizes no quarantine.

## #251 historical window-lifetime evidence

`test/e2e/plasmon-golden-path-window-lifetime.spec.ts` remains required under the serialized harness. #251 preserves prior parallel Specialist failure evidence only. No current serialized failure has reopened that disposition, and no quarantine is authorized.

## Required Specialist inventory

`npm run test:e2e:plasmon:specialist` keeps the complete current Specialist inventory present and required:

- `test/e2e/plasmon-golden-path.spec.ts` — required, including synchronized left-edge snap-preview proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — required; #244 restored snapped -> restore -> opposite-edge/right-snap preview and geometry proof.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required; #251 historical evidence only.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — required.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — required; both local-asset/network-safety and restored #245 readiness/canvas/core-start coverage execute.
- `test/e2e/plasmon-demo-game.spec.ts` — required with #250 deterministic activation repair integrated.
- `test/e2e/plasmon-first-demo.spec.ts` — required; integrated #181 first-demo document/media fixture acceptance.

BrowserHealth, package/security validation, worker/asset validation, persistence, and fail-on-flaky behavior for every required test remain unchanged.

#244 and #245 are the canonical restoration Issues for the two formerly quarantined acceptances. On this child branch both are required, so the authorized active quarantine set is empty. Additional quarantines require new explicit owner authorization and concrete evidence.