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
| Explorer sibling lifetime | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `packaged Plasmon repeatedly opens and closes reachable Explorer siblings` — tags `@r2-quarantine @issue-251` | second Explorer creation stays at native-window count 1 instead of 2 | #251 |
| Alt-Tab multi-instance setup | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary` — tags `@r2-quarantine @issue-63 @issue-308` | second-Explorer creation failure occurs before Alt-Tab semantics are reached | #308 |
| Grouped Explorer chooser-title readiness | `test/e2e/plasmon-review-demo.spec.ts` — `#118 groups canonical Explorer processes and focuses individual members` — tags `@r2-quarantine @issue-303` | chooser opens after both Explorers exist, but `This Plasmon; Minimized` is not visible on first attempt; retry passes | #303 |
| js-dos saved-preview blob readiness | `test/e2e/plasmon-demo-game.spec.ts` — `saved js-dos resource publishes a blob-backed preview after save` — tags `@r2-quarantine @issue-124 @issue-304` | flake probe `31917209424`, attempt 1/10: expected thumbnail `src` `/^blob:/`, observed `static/plasmon/artwork/plasmon-demo.svg` | #304 |
| #66 drag-preview / directory-drop completion | `test/e2e/plasmon-drag-preview-66.spec.ts` — `#66 active multi-selection drag preview is above windows and transparent to hit testing` — tags `@r2-quarantine @issue-66 @issue-320` | independent retry-free probes `31926388328` attempt 9/10 and `31950894639` attempt 8/10: final Explorer directory-drop source expected count 0, received 1 | #320 |
| #360 drag-feedback request cancellation | `test/e2e/plasmon-drag-feedback-360.spec.ts` — `#360 Desktop item moves into an already-open folder window`; `#360 target feedback changes A to B to invalid and invalid, cancel, and unmount paths clear drag state`; and `#360 multi-selection keeps a recognizable grouped preview and moves the selected group` — tags `@r2-quarantine @issue-360 @issue-420` | recurring first-attempt failures after #360 behavior assertions complete, with final strict BrowserHealth rejecting first-party `file.svg` `net::ERR_ABORTED`; PR #417 probe `32513632061` attempts 1 and 7, plus PR #422 required Browser `32516432142` and retry-free probe `32516432137` attempt 8 | #420 |
| #86 diagnostic-selection / New Folder rename readiness | `test/e2e/plasmon-diagnostic-selection-86.spec.ts` — `#86 diagnostic text selects without stealing FileEntry drag` — tags `@r2-quarantine @issue-86 @issue-330` | unrelated PR #328 flake probe `31976275024`, attempt 1/10: after `New Folder`, expected rename textbox never appears within 20s; Specialist result 1 failed / 8 passed | #330 |
| #89 packaged Monaco worker / editor-input readiness | `test/e2e/plasmon-monaco-workers-89.spec.ts` — `#89 packaged Monaco workers use Program Files authority through the opaque-origin transport` — tags `@r2-quarantine @issue-89 @issue-391` | PR #389 exact-head flake probe `32317329247`: 8/10 pass; attempts 4/10 and 10/10 fail during editor-input readiness while same-head required Specialist passes | #391 |

The #251 and #308 tests currently exhibit the same second-Explorer setup signature, but workflow v4.0 tracks their quarantine removal independently because each confirmed flaky test has its own dedicated repair Issue.

The #304 quarantine is intentionally narrower than the surrounding demo-game journey. The normal packaged fixture opening, #250 coverage, #123 static artwork behavior, #202 sandbox-storage contract, and #64 save/reopen persistence acceptance remain required. Static package artwork is not an accepted substitute for #124's blob-backed saved preview.

The #320 quarantine is limited to the single #66 acceptance. The spec stays in Specialist inventory; only the tagged test is filtered. The two observed failures occur after the preview stacking/hit-testing checks, at the final canonical Explorer directory-drop completion assertion. Product Issue #66 remains the canonical behavior owner while #320 owns CI stability and restoration.

The #420 quarantine is limited to three exact #360 acceptances. The Desktop ghost/release-continuity acceptance remains required. Independent unrelated-PR and exact-head retry-free evidence reproduces the quarantined tests nondeterministically, including the target-transition/invalid/cancel/unmount acceptance on PR #422 required Browser CI and Flake Probe 8/10. The failures reach their #360 assertions and then strict BrowserHealth observes first-party `file.svg` `net::ERR_ABORTED`. #420 owns root-cause repair and restoration; BrowserHealth remains strict and there is no generic `ERR_ABORTED`, `file.svg`, or asset-request allowlist. Closed Issue #217's historical `folder.svg` presentation-churn defect is context only; its exact root cause is not assumed for the current `file.svg` failures.

The #330 quarantine is limited to the single #86 acceptance introduced by #274. The spec stays in Specialist inventory; only the tagged test is filtered. The archived unrelated-PR failure occurs during FileManager setup after choosing `New Folder`, before the diagnostic text-selection and post-dismissal drag contracts are reached. Product Issue #86 remains the canonical behavior owner while #330 owns CI stability and restoration.

The #391 quarantine is limited to the single #89 packaged Monaco worker acceptance. PR #389's exact head passes the acceptance in required Packaged Browser CI but fails it on two of ten fresh retry-free flake-probe attempts, and independent PR #363 was 10/10 clean. The observed failures occur during editor-input readiness before the worker authority/message assertions. Product Issue #89 remains the canonical worker behavior owner while #391 owns CI stability and restoration; no Monaco worker assertion is removed or weakened.

## #244 right-snap / snap-preview restoration

Issue #244 restores `test/e2e/plasmon-golden-path-right-snap.spec.ts` — `packaged Plasmon restores a left-snapped native window and previews right snap` — to required serialized Specialist execution. It carries `@issue-244` and no longer carries `@r2-quarantine`.

The restored acceptance synchronizes the real rendered pointer journey on production `data-interacting="drag"` state before iframe-edge movement and waits for that state to clear after release. It preserves preview geometry, usable-workspace containment, and final WindowManager snap-state assertions without sleeps, timeout inflation, retry-policy changes, weakened assertions, or product hooks.

#244 remains the canonical restoration Issue until its required exact-head verification is complete and the Coordinator removes its block.

## #245 EmulatorJS readiness restoration

Issue #245 restores `test/e2e/plasmon-emulatorjs-proof.spec.ts` — `packaged Plasmon imports a legal NES fixture and initializes EmulatorJS from local assets` — to required Specialist execution. It carries `@issue-245` and no longer carries `@r2-quarantine`.

Readiness is observed through the existing production `data-emulatorjs-phase="game-started"` / `data-emulatorjs-ready="true"` lifecycle using a browser-side `MutationObserver`. The existing overall safety bound, local-asset assertions, canvas proof, request/error checks, and teardown remain intact; no production EmulatorJS semantics are changed merely to obtain green.

The current #245 stability count entering this reconciled child is 4/5. The previous attempted fifth run did not reach Playwright because the now-integrated #161 Mops materialization defect failed during Kernel packaging, so it neither advanced nor reset #245. This reconciled stack contains #161 and is the authorized environment for the fifth qualifying execution.

## Exact BrowserHealth diagnostic quarantine

Issue #305 owns one shared Chromium diagnostic observed after the #66 product interaction completed successfully:

```text
An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.
```

`test/e2e/plasmon-browser-health.ts` classifies **only that full `console.warn` message** as an r2 known diagnostic. It does not use a substring match and does not allow other console warnings/errors, page errors, first-party request failures, or HTTP failures. The #305 diagnostic rule is separate from the #320 test-level quarantine.

## Known #295 signatures deliberately not silenced by test skip

- **#268 — Explorer normalization drag:** the signature is inside the large required `plasmon-golden-path.spec.ts` acceptance. Skipping that entire test would suppress unrelated desktop contracts. The current integrated tree contains the dedicated #268 repair, and the post-merge #300 fresh probe did not reproduce the normalization-drag signature; its two failures were second-Explorer creation in the #251 and #308 tests. #219 historical Browser evidence is deduplicated to #268. Keep #268 active until its own unquarantined stability proof is complete.
- **#289 — PocketIC supervised process loss:** this is shared environment loss, not one test. Any arbitrary test can fail after PocketIC exits; `ERR_CONNECTION_REFUSED` remains a hard failure.
- **#306 — Fast Bun job cancellation / time-limit:** this is a workflow/job signature, not one test. Fast CI remains required and cancellations remain failures.
- **EmulatorJS fixture-selection observation from PR #417:** Flake Probe `32513632061` attempt 10 observed `PlasmonTest.nes` remain `aria-selected="false"` in `packaged Plasmon loads EmulatorJS from local assets without external runtime requests`, while the following EmulatorJS initialization acceptance passed. Ledger #295 classifies this as an ambient flake candidate requiring independent recurrence; it remains required and fail-closed rather than being quarantined from one observation.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #268 is not broad-skipped.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — retained; exact #277 test quarantined pending #279 restoration proof.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — required; #244 restores snapped -> restore -> opposite-edge/right-snap preview and geometry proof.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — retained; only the sibling-lifetime acceptance under #251 and the #63 Alt-Tab acceptance under #308 are quarantined.
- `test/e2e/plasmon-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-monaco-workers-89.spec.ts` — retained; its single #89/#391 acceptance is quarantined pending editor-readiness root-cause repair and restoration proof.
- `test/e2e/plasmon-review-demo.spec.ts` — retained; only the #118/#303 chooser-title acceptance is quarantined.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — required; #245 restores the production readiness/canvas/core-start proof while retaining loader/local-asset/network-safety coverage. The PR #417 one-off fixture-selection observation is not quarantined without independent recurrence.
- `test/e2e/plasmon-demo-game.spec.ts` — retained; only the dedicated #124/#304 saved-preview blob-readiness acceptance is quarantined. The broad #250/#123/#202/#64 demo-game journey remains required.
- `test/e2e/plasmon-drag-preview-66.spec.ts` — retained; its single #66/#320 acceptance is quarantined pending restoration proof.
- `test/e2e/plasmon-drag-feedback-360.spec.ts` — retained; exactly the open-folder move, target-transition/invalid/cancel/unmount, and grouped multi-selection acceptances are quarantined under #420. The Desktop ghost/release-continuity #360 acceptance remains required.
- `test/e2e/plasmon-diagnostic-selection-86.spec.ts` — retained; its single #86/#330 acceptance is quarantined pending restoration proof.
- `test/e2e/plasmon-first-demo.spec.ts` — required.

Targeted flake-probe validation may select `saved-preview`, which executes only the `@issue-304` acceptance with retries disabled. The normal required Specialist path continues to exclude `@r2-quarantine` tests.

Package/security validation, worker/asset validation, persistence, and fail-on-unknown behavior remain required. The only BrowserHealth exception is the exact #305 diagnostic above.

## Removal contract

A quarantined acceptance returns to required CI through its linked repair/restoration Issue after deterministic root-cause repair, retries=0 validation, and that Issue's required clean first-attempt evidence. Removing one quarantine must not remove or weaken unrelated required coverage.

For #304 specifically, the dedicated saved-preview acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the required `blob:` preview contract before this quarantine is removed. Static artwork remains a failure for that acceptance.

For #320 specifically, the exact #66 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the final canonical Explorer directory-drop assertion before this quarantine is removed.

For #420 specifically, each of the three exact #360 acceptances must be exercised **unquarantined** with retries=0 and pass five consecutive clean first-attempt packaged Specialist executions before its quarantine is removed. The canonical same-NodeId move, target-transition/invalid/cancel/unmount cleanup, destination feedback, grouped-preview/grouped-move assertions, and strict BrowserHealth must remain intact; no generic request-abort or asset allowance is an acceptable restoration.

For #330 specifically, the exact #86 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the diagnostic text-selection, no-stolen-drag-state, and post-dismissal FileEntry drag assertions before this quarantine is removed.

For #391 specifically, the exact #89 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining installed Program Files authority, opaque-origin `blob:` transport, real editor + TypeScript worker construction/message exchange, and strict worker/page/browser-health assertions before this quarantine is removed.

No new quarantine is implied by a failed run. Preserve the evidence, classify it in #295, create/reuse the dedicated repair Issue, and add an explicit narrow quarantine change only when authorized.
