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
| Explorer sibling lifetime | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `packaged Plasmon repeatedly opens and closes reachable Explorer siblings` — tags `@r2-quarantine @issue-251` | second Explorer creation stays at native-window count 1 instead of 2 | #251 |
| Alt-Tab multi-instance setup | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary` — tags `@r2-quarantine @issue-63 @issue-308` | second-Explorer creation failure occurs before Alt-Tab semantics are reached | #308 |
| js-dos saved-preview blob readiness | `test/e2e/plasmon-demo-game.spec.ts` — `saved js-dos resource publishes a blob-backed preview after save` — tags `@r2-quarantine @issue-124 @issue-304` | flake probe `31917209424`, attempt 1/10: expected thumbnail `src` `/^blob:/`, observed `static/plasmon/artwork/plasmon-demo.svg` | #304 |
| #371 Explorer-to-Desktop placement | `test/e2e/plasmon-drag-placement-371.spec.ts` — `#371 Explorer to Desktop drop commits the icon where the ghost is released` — tags `@r2-quarantine @issue-371 @issue-406` | PR #372 retry-free probe `32320470807` passed 2/10 and failed 8/10; unrelated PR #418 probe `32513444540` independently recurred on attempt 4 while #371 was unchanged | #406 |
| #89 packaged Monaco worker / editor-input readiness | `test/e2e/plasmon-monaco-workers-89.spec.ts` — `#89 packaged Monaco workers use Program Files authority through the opaque-origin transport` — tags `@r2-quarantine @issue-89 @issue-391` | PR #389 exact-head flake probe `32317329247`: 8/10 pass; attempts 4/10 and 10/10 fail during editor-input readiness while same-head required Specialist passes | #391 |
| #415 Text language-transition browser readiness | `test/e2e/plasmon-demo-text-language-transition.spec.ts` — `[demo profile] #415 Text classifies FileManager rename and Save As language transitions in live Monaco` — tags `@r2-quarantine @issue-415 @issue-434` | independent retry-free probes `32520634935` and `32525873804` each passed 9/10; failures occur at different pre-assertion readiness boundaries (Desktop fixture entry vs Plasmon Taskbar) before the Monaco language-transition contract is reached | #434 |

## #279 left-snap / snap-preview restoration proof

Issue #279 restores `test/e2e/plasmon-golden-path-left-snap.spec.ts` — `packaged Plasmon previews and commits left snap` — to required serialized Specialist execution. This is the restoration owner for the quarantine created under #277. The test retains `@issue-277` history and adds `@issue-279`; it no longer carries `@r2-quarantine` on the restoration head.

The restored acceptance uses the shared real-titlebar pointer helper: Playwright first establishes titlebar actionability, the helper then derives a currently hit-testable non-control point, raw mouse input establishes the production `data-interacting="drag"` lifecycle, and release waits for that lifecycle to clear. Visible left preview, preview geometry, usable-workspace containment, and committed `data-window-snap="left"` remain required.

Quarantine removal is provisional until #279's exact-head proof completes. The restoration head must remain retries=0 and pass the requested fresh 10+50 flake-probe evidence plus the Issue-required clean first-attempt Specialist evidence. Any owned red resets the restoration claim; no sleep, timeout inflation, retry-as-fix, Product hook, or geometry weakening is allowed.

The #251 and #308 tests currently exhibit the same second-Explorer setup signature, but workflow v4.0 tracks their quarantine removal independently because each confirmed flaky test has its own dedicated repair Issue.

The #304 quarantine is intentionally narrower than the surrounding demo-game journey. The normal packaged fixture opening, #250 coverage, #123 static artwork behavior, #202 sandbox-storage contract, and #64 save/reopen persistence acceptance remain required. Static package artwork is not an accepted substitute for #124's blob-backed saved preview.

## #320 directory-drop completion restoration

Issue #320 restores the exact `test/e2e/plasmon-drag-preview-66.spec.ts` acceptance to required Specialist execution with its real pointer path, preview stacking/hit-testing checks, and final canonical Explorer source-removal assertion unchanged.

The preserved retry-free failures reached the directory-drop operation/refresh pipeline and then surfaced `Too many concurrent frontend tool calls`. The shared #317 repair is now integrated on `release/0.1.0-r2` via PR #458 and bounds Plasmon foreground frontend-call admission at Kernel's per-caller concurrency cap, so excess move/refresh work queues rather than allowing a ninth frontend call to be rejected. #320 carries no duplicate transport fix and changes only restoration bookkeeping.

#320 remains the restoration owner until its exact unquarantined retries=0 proof completes. Any recurrence must be traced as a new event-timeline failure rather than hidden with waits or retries.

## #303 grouped Explorer chooser-title restoration

Issue #303 restores `test/e2e/plasmon-demo-review.spec.ts` — `[demo profile] #118 groups canonical Explorer processes and focuses individual members` — to required Specialist execution. The repair binds the already-created primary Explorer by stable native-window identity and waits for that same production window to publish accessible name `This Plasmon` before minimizing it. The final grouped chooser assertion remains exactly `This Plasmon; Minimized`; no sleep, retry, timeout inflation, Product hook, fallback selector, or weakened chooser assertion is introduced.

Exact repair head `af8e6e763ad7e9a75433d8a16e9d7fc92913038e` produced 10/10 clean retry-free baseline packets and 50/50 targeted characterization packets, for 60/60 clean first-attempt executions with no chooser-title recurrence. The exact #118 acceptance is therefore removed from `@r2-quarantine` while the rest of `plasmon-demo-review.spec.ts` remains required and unchanged.

## #420 drag-feedback request-cancellation restoration

Issue #420 restores the three #360 acceptances in `test/e2e/plasmon-drag-feedback-360.spec.ts` to required Specialist execution. Their same-NodeId move, target-transition/invalid/cancel/unmount cleanup, destination feedback, grouped-preview/grouped-move assertions, and strict BrowserHealth remain unchanged.

Trace evidence identified the aborted `file.svg` as presentation churn on the same mounted Desktop `Root` shortcut NodeId: a transient node-target resolution failure replaced last-good `folder.svg` artwork with generic `file.svg`, and the next successful resolution restored `folder.svg`, causing Chromium to cancel the superseded request. The production repair preserves last-good artwork when node-target shortcut enrichment is temporarily unavailable while retaining deterministic fallback for new entries and direct resolver callers. No `ERR_ABORTED`, `file.svg`, or request-failure allowance is introduced.

#420 remains the restoration owner until its required exact-head unquarantined retries=0 proof completes.

The #406 quarantine is limited to the single #371 Explorer-to-Desktop placement acceptance. It is now present on `release/0.1.0-r2`, satisfying #406's integration boundary for temporary quarantine. The test body and its same-NodeId move, drop-target, grab-offset, ghost-release, committed-position, and strict BrowserHealth assertions remain unchanged; only the exact test is tagged. Product Issue #371 remains the behavior owner while #406 owns repair and restoration.

## #330 diagnostic-selection / New Folder rename restoration

Issue #330 restores `test/e2e/plasmon-diagnostic-selection-86.spec.ts` — `#86 diagnostic text selects without stealing FileEntry drag` — to required Specialist execution. The repair observes completion of each preceding inline-rename lifecycle after Escape before starting the next FileManager create/open action, using the production rename textbox as the authoritative rendered state boundary. The original diagnostic selection, no-stolen-drag-state, and post-dismissal FileEntry drag assertions remain intact; no sleep, retry, timeout inflation, fallback assertion, Product hook, or broad quarantine is introduced.

Exact repair head `e7481f69c123fadd09b86001a278a520f7a2a4b8` produced 10/10 clean retry-free baseline packets and 50/50 targeted characterization packets, for 60/60 clean first-attempt executions in a healthy packaged environment. The exact #86 acceptance is therefore removed from `@r2-quarantine`. Restoration evidence is also recorded on ledger Issue #295.

The #391 quarantine is limited to the single #89 packaged Monaco worker acceptance. PR #389's exact head passes the acceptance in required Packaged Browser CI but fails it on two of ten fresh retry-free flake-probe attempts, and independent PR #363 was 10/10 clean. The observed failures occur during editor-input readiness before the worker authority/message assertions. Product Issue #89 remains the canonical worker behavior owner while #391 owns CI stability and restoration; no Monaco worker assertion is removed or weakened.

The #434 quarantine is limited to the demo-profile #415 Text language-transition acceptance. The demo test remains in the profile-specific inventory with its FileManager rename, Save As, Monaco model identity, language status, tokenization, reopen persistence, round-trip-to-plaintext, and strict BrowserHealth assertions unchanged. PR #418 and unrelated PR #427 independently reproduced readiness failures before the #415 language assertions. Product Issue #415 remains the behavior owner while #434 owns the demo-profile restoration.

Issue #505 supplies the neutral companion acceptance in `test/e2e/plasmon-text-language-transition.spec.ts`. It creates both source resources through ordinary packaged FileManager operations and runs as required Specialist coverage without `plasmon:demo`, demo assets, demo filenames, query fixtures, or Gemma allowances.

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

`test/e2e/plasmon-browser-health.ts` classifies **only that full `console.warn` message** as an r2 known diagnostic. It does not use a substring match and does not allow other console warnings/errors, page errors, first-party request failures, or HTTP failures. The #305 diagnostic rule is separate from the #320 restoration test.

## Known #295 signatures deliberately not silenced by test skip

- **#268 — Explorer normalization drag:** the signature is inside the large required `plasmon-golden-path.spec.ts` acceptance. Skipping that entire test would suppress unrelated desktop contracts. The current integrated tree contains the dedicated #268 repair, and the post-merge #300 fresh probe did not reproduce the normalization-drag signature; its two failures were second-Explorer creation in the #251 and #308 tests. #219 historical Browser evidence is deduplicated to #268. Keep #268 active until its own unquarantined stability proof is complete.
- **#289 — PocketIC supervised process loss:** this is shared environment loss, not one test. Any arbitrary test can fail after PocketIC exits; `ERR_CONNECTION_REFUSED` remains a hard failure.
- **#306 — Fast Bun job cancellation / time-limit:** this is a workflow/job signature, not one test. Fast CI remains required and cancellations remain failures.
- **EmulatorJS fixture-selection observation from PR #417:** Flake Probe `32513632061` attempt 10 observed `PlasmonTest.nes` remain `aria-selected="false"` in `packaged Plasmon loads EmulatorJS from local assets without external runtime requests`, while the following EmulatorJS initialization acceptance passed. Ledger #295 classifies this as an ambient flake candidate requiring independent recurrence; it remains required and fail-closed rather than being quarantined from one observation.

## Required Specialist inventory while quarantine is active

`npm run test:e2e:plasmon:specialist` keeps every Specialist spec present and excludes only the explicitly tagged tests above:

- `test/e2e/plasmon-golden-path.spec.ts` — required; #268 is not broad-skipped.
- `test/e2e/plasmon-golden-path-left-snap.spec.ts` — required on #279's restoration head; exact left preview/snap geometry remains fail-closed.
- `test/e2e/plasmon-golden-path-right-snap.spec.ts` — required; #244 restores snapped -> restore -> opposite-edge/right-snap preview and geometry proof.
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — retained; only the sibling-lifetime acceptance under #251 and the #63 Alt-Tab acceptance under #308 are quarantined.
- `test/e2e/plasmon-demo-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-monaco-workers-89.spec.ts` — retained; its single #89/#391 acceptance is quarantined pending editor-readiness root-cause repair and restoration proof.
- `test/e2e/plasmon-demo-review.spec.ts` — required; #303 restores the exact #118 grouped Explorer chooser-title acceptance with 60/60 clean first-attempt proof.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — required; #245 restores the production readiness/canvas/core-start proof while retaining loader/local-asset/network-safety coverage. The PR #417 one-off fixture-selection observation is not quarantined without independent recurrence.
- `test/e2e/plasmon-demo-game.spec.ts` — retained; only the dedicated #124/#304 saved-preview blob-readiness acceptance is quarantined. The broad #250/#123/#202/#64 demo-game journey remains required.
- `test/e2e/plasmon-drag-preview-66.spec.ts` — required; #320 restores the exact #66 acceptance with its canonical final directory-drop assertion unchanged.
- `test/e2e/plasmon-drag-feedback-360.spec.ts` — required; #420 restores the open-folder move, target-transition/invalid/cancel/unmount, and grouped multi-selection acceptances while the Desktop ghost/release-continuity acceptance remains continuously required.
- `test/e2e/plasmon-drag-placement-371.spec.ts` — retained; its single #371/#406 placement acceptance is quarantined pending deterministic repair and restoration proof.
- `test/e2e/plasmon-diagnostic-selection-86.spec.ts` — required; #330 restores the exact #86 diagnostic-selection acceptance with 60/60 clean first-attempt proof.
- `test/e2e/plasmon-demo-text-language-transition.spec.ts` — retained; its single demo-profile #415/#434 acceptance is quarantined pending demo browser-readiness restoration.
- `test/e2e/plasmon-text-language-transition.spec.ts` — required; #505 provides neutral #415 language-transition coverage through self-created FileManager resources.

Targeted flake-probe validation may select `saved-preview`, which executes only the `@issue-304` acceptance with retries disabled. The normal required Specialist path continues to exclude `@r2-quarantine` tests.

Package/security validation, worker/asset validation, persistence, and fail-on-unknown behavior remain required. The only BrowserHealth exception is the exact #305 diagnostic above.

## Removal contract

A quarantined acceptance returns to required CI through its linked repair/restoration Issue after deterministic root-cause repair, retries=0 validation, and that Issue's required clean first-attempt evidence. Removing one quarantine must not remove or weaken unrelated required coverage.

For #279 specifically, the exact left-snap acceptance must remain unquarantined with retries=0 and complete the requested fresh 10+50 probe plus the Issue-required clean first-attempt Specialist proof while retaining the real titlebar pointer path, visible preview, preview geometry, workspace containment, and final left-snap state. Any owned red restores the hold.

For #304 specifically, the dedicated saved-preview acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the required `blob:` preview contract before this quarantine is removed. Static artwork remains a failure for that acceptance.

For #320 specifically, the exact #66 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining the final canonical Explorer directory-drop assertion before this quarantine is removed.

For #406 specifically, the exact #371 acceptance must be run **unquarantined** with retries=0 and pass five consecutive clean first-attempt packaged Specialist executions while retaining same-NodeId move authority, canonical Desktop placement, grab-offset/ghost-release geometry, committed-position assertions, and strict BrowserHealth before this quarantine is removed.

For #420 specifically, each of the three exact #360 acceptances must be exercised **unquarantined** with retries=0 and pass five consecutive clean first-attempt packaged Specialist executions before its quarantine is removed. The canonical same-NodeId move, target-transition/invalid/cancel/unmount cleanup, destination feedback, grouped-preview/grouped-move assertions, and strict BrowserHealth must remain intact; no generic request-abort or asset allowance is an acceptable restoration.

For #391 specifically, the exact #89 acceptance must be run **unquarantined** and pass five consecutive clean first attempts with retries=0 while retaining installed Program Files authority, opaque-origin `blob:` transport, real editor + TypeScript worker construction/message exchange, and strict worker/page/browser-health assertions before this quarantine is removed.

For #434 specifically, the exact #415 Text language-transition acceptance must be run **unquarantined** with retries=0 and pass a clean 10/10 fresh Flake Probe while retaining FileManager rename and Save As transitions, Monaco model identity, JavaScript/plaintext status and tokenization, reopen persistence, round-trip behavior, and strict BrowserHealth before this quarantine is removed.

No new quarantine is implied by a failed run. Preserve the evidence, classify it in #295, create/reuse the dedicated repair Issue, and add an explicit narrow quarantine change only when authorized.
