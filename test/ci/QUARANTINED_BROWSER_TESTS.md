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
| Alt-Tab multi-instance setup | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary` — tags `@r2-quarantine @issue-63 @issue-308` | second-Explorer creation failure occurs before Alt-Tab semantics are reached | #308 |
| Grouped Explorer chooser-title readiness | `test/e2e/plasmon-review-demo.spec.ts` — `#118 groups canonical Explorer processes and focuses individual members` — tags `@r2-quarantine @issue-303` | chooser opens after both Explorers exist, but `This Plasmon; Minimized` is not visible on first attempt; retry passes | #303 |
| EmulatorJS packaged readiness acceptance | `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — tags `@r2-quarantine @issue-245` | readiness timeout followed by passing retry | #245 |
| js-dos saved-preview blob readiness | `test/e2e/plasmon-demo-game.spec.ts` — `saved js-dos resource publishes a blob-backed preview after save` — tags `@r2-quarantine @issue-124 @issue-304` | flake probe `31917209424`, attempt 1/10: expected thumbnail `src` `/^blob:/`, observed `static/plasmon/artwork/plasmon-demo.svg` | #304 |
| #66 drag-preview / directory-drop completion | `test/e2e/plasmon-drag-preview-66.spec.ts` — `#66 active multi-selection drag preview is above windows and transparent to hit testing` — tags `@r2-quarantine @issue-66 @issue-320` | independent retry-free probes `31926388328` attempt 9/10 and `31950894639` attempt 8/10: final Explorer directory-drop source expected count 0, received 1 | #320 |

The #251 and #308 tests currently exhibit the same second-Explorer setup signature, but workflow v4.0 tracks their quarantine removal independently because each confirmed flaky test has its own dedicated repair Issue.

The #304 quarantine is intentionally narrower than the surrounding demo-game journey. The normal packaged fixture opening, #250 coverage, #123 static artwork behavior, #202 sandbox-storage contract, and #64 save/reopen persistence acceptance remain required. Static package artwork is not an accepted substitute for #124's blob-backed saved preview.

The #320 quarantine is limited to the single #66 acceptance. The spec stays in Specialist inventory; only the tagged test is filtered. The two observed failures occur after the preview stacking/hit-testing checks, at the final canonical Explorer directory-drop completion assertion. Product Issue #66 remains the canonical behavior owner while #320 owns CI stability and restoration.

## Exact BrowserHealth diagnostic quarantine

Issue #305 owns one shared Chromium diagnostic observed after the #66 product interaction completed successfully:

```text
An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.
```

`test/e2e/plasmon-browser-health.ts` classifies **only that full `console.warn` message** as an r2 known diagnostic. It does not use a substring match and does not allow other console warnings/errors, page errors, first-party request failures, or HTTP failures. The #305 diagnostic rule is separate from the #320 test-level quarantine.

## Known #295 signatures deliberately not silenced by test skip

- **#268 — Explorer normalization drag:** the signature is inside the large required `plasmon-golden-path.spec.ts` acceptance. Skipping that entire test would suppress unrelated desktop contracts. The current integrated tree contains the dedicated #268 repair, and the post-merge #300 fresh probe did not reproduce the normalization-drag signature; its two failures were second-Explorer creation in the #251 and #308 tests. #219 historical Browser evidence is deduplicated to #268. Keep #268 active until its own unquarantined stability proof is complete.
- **#289 — PocketIC supervised process loss:** this is shared environment loss, not one test. Any arbitrary test can fail after PocketIC exits; `ERR_CONNECTION_REFUSED` remains a hard failure.
- **#306 — Fast Bun job cancellation/time-limit:** this is a workflow/job signature, not one test. Fast CI remains required and cancellations remain failures.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #268 is not broad-skipped.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — retained; exact #277 test quarantined pending #279 restoration proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — retained; exact #244 test quarantined.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — retained; only the sibling-lifetime acceptance under #251 and the #63 Alt-Tab acceptance under #308 are quarantined.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-review-demo.spec.ts` — retained; only the #118/#303 chooser-title acceptance is quarantined.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — retained; only the #245 readiness/canvas/core-start acceptance is quarantined.
- `test/e2e/plasmon-demo-game.spec.ts` — retained; only the dedicated #124/#304 saved-preview blob-readiness acceptance is quarantined. The broad #250/#123/#202/#64 demo-game journey remains required.
- `test/e2e/plasmon-drag-preview-66.spec.ts` — retained; its single #66/#320 acceptance is quarantined pending restoration proof.
- `test/e2e/plasmon-first-demo.spec.ts` — required.

Targeted flake-probe validation may select `saved-preview`, which executes only the `@issue-304` acceptance with retries disabled. The normal required Specialist path continues to exclude `@r2-quarantine` tests.

Package/security validation, worker/asset validation, persistence, and fail-on-unknown behavior remain required. The only BrowserHealth exception is the exact #305 diagnostic above.

## Removal contract

A quarantined acceptance returns to required CI through its linked repair/restoration Issue after deterministic root-cause repair, retries=0 validation, and that Issue's required clean first-attempt evidence. Removing one quarantine must not remove or weaken unrelated required coverage.

For #304 specifically, the dedicated saved-preview acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the required `blob:` preview contract before this quarantine is removed. Static artwork remains a failure for that acceptance.

For #320 specifically, the exact #66 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the final canonical Explorer directory-drop assertion before this quarantine is removed.

No new quarantine is implied by a failed run. Preserve the evidence, classify it in #295, create/reuse the dedicated repair Issue, and add an explicit narrow quarantine change only when authorized.
