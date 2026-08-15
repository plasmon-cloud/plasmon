# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only owner-authorized known flaky acceptances. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, timeout increase, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --grep-invert @r2-quarantine ...
```

Every active quarantine below has a dedicated repair Issue. Unknown failures, deterministic Product failures, PocketIC loss, runner cancellation, and all unlisted browser-health diagnostics continue to fail CI.

## Active `@r2-quarantine` tests

| Required-CI quarantine | Exact spec/test | Known signature | Repair / restoration Issue |
| --- | --- | --- | --- |
| Shared left-snap preview acceptance | `test/e2e/plasmon-golden-path-left-snap.spec.ts` — `packaged Plasmon previews and commits left snap @issue-277` — tags `@r2-quarantine @issue-277` | shared #43 left-preview assertion failed first attempt and passed retry | #279 |
| Right-snap / snap-preview acceptance | `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — tags `@r2-quarantine @issue-244` | right snap-preview assertion timed out on initial attempt and retry | #244 |
| Explorer sibling lifetime | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `packaged Plasmon repeatedly opens and closes reachable Explorer siblings` — tags `@r2-quarantine @issue-251` | second Explorer creation stays at native-window count 1 instead of 2 | #251 |
| Alt-Tab multi-instance setup | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary` — tags `@r2-quarantine @issue-63 @issue-251` | same second-Explorer creation failure occurs before Alt-Tab semantics are reached | #251 (deduplicated same signature) |
| Grouped Explorer chooser-title readiness | `test/e2e/plasmon-review-demo.spec.ts` — `#118 groups canonical Explorer processes and focuses individual members` — tags `@r2-quarantine @issue-303` | chooser opens after both Explorers exist, but `This Plasmon; Minimized` is not visible on first attempt; retry passes | #303 |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | readiness timeout followed by passing retry | #245 |

## Exact BrowserHealth diagnostic quarantine

Issue #305 owns one shared Chromium diagnostic observed after the #66 product interaction completed successfully:

```text
An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.
```

`test/e2e/plasmon-browser-health.ts` classifies **only that full `console.warn` message** as an r2 known diagnostic. It does not use a substring match and does not allow other console warnings/errors, page errors, first-party request failures, or HTTP failures. #66 itself is not skipped.

## Known #295 signatures deliberately not silenced by test skip

- **#268 — Explorer normalization drag:** the signature is inside the large required `plasmon-golden-path.spec.ts` acceptance. Skipping that entire test would suppress unrelated desktop contracts. The current integrated tree contains the dedicated #268 repair, and the post-merge #300 fresh probe did not reproduce the normalization-drag signature; its two failures were #251 second-Explorer creation. #219 historical Browser evidence is deduplicated to #268. Keep #268 active until its own unquarantined stability proof is complete.
- **#304 — #124 saved-preview blob readiness:** the flaky `static/plasmon/artwork/plasmon-demo.svg` versus `blob:` assertion exists only on unmerged PR #299, not on the current release test. Do not quarantine the release's broader stable demo-game acceptance. When #299 is reconciled, isolate/tag only the #124 acceptance path under #304.
- **#289 — PocketIC supervised process loss:** this is shared environment loss, not one test. Any arbitrary test can fail after PocketIC exits; `ERR_CONNECTION_REFUSED` remains a hard failure.
- **#306 — Fast Bun job cancellation/time-limit:** this is a workflow/job signature, not one test. Fast CI remains required and cancellations remain failures.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #268 is not broad-skipped.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — retained; exact #277 test quarantined pending #279 restoration proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained; exact #244 test quarantined.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — retained; only the two acceptances demonstrated to hit the #251 second-Explorer signature are quarantined.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — retained; only the #118/#303 chooser-title acceptance is quarantined.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — retained; only the #245 readiness/canvas/core-start acceptance is quarantined.
- `test/e2e/plasmon-demo-game.spec.ts` — required on current release; #304 records the unmerged #124 recurrence without broad-skipping the existing acceptance.
- `test/e2e/plasmon-first-demo.spec.ts` — required.

Package/security validation, worker/asset validation, persistence, and fail-on-unknown behavior remain required. The only BrowserHealth exception is the exact #305 diagnostic above.

## Removal contract

A quarantined acceptance returns to required CI through its linked repair/restoration Issue after deterministic root-cause repair, retries=0 validation, and that Issue's required clean first-attempt evidence. Removing one quarantine must not remove or weaken unrelated required coverage.

No new quarantine is implied by a failed run. Preserve the evidence, classify it in #295, create/reuse the dedicated repair Issue, and add an explicit narrow quarantine change only when authorized.