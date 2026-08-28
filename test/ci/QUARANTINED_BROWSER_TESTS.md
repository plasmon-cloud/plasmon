# Required CI browser quarantines

The r2 Specialist lane keeps its complete spec inventory present and filters only owner-authorized known flaky acceptances. Quarantine is test-level and explicit; it is not a spec deletion, file-level removal, retry exception, timeout increase, or allow-failure policy.

Required Specialist runs serialized and uses Playwright filtering:

```text
playwright test --workers=1 --retries=0 --grep-invert @r2-quarantine ...
```

Every active quarantine below has a dedicated repair Issue. Unknown failures, deterministic Product failures, PocketIC loss, runner cancellation, and all unlisted browser-health diagnostics continue to fail CI.

## Active `@r2-quarantine` tests

| Required-CI quarantine | Exact spec/test | Known signature | Repair / restoration Issue |
| --- | --- | --- | --- |
| js-dos saved-preview blob readiness | `test/e2e/plasmon-demo-game.spec.ts` — `saved js-dos resource publishes a blob-backed preview after save` — tags `@r2-quarantine @issue-124 @issue-304` | flake probe `31917209424`, attempt 1/10: expected thumbnail `src` `/^blob:/`, observed `static/plasmon/artwork/plasmon-demo.svg` | #304 |
| #415 Text language-transition browser readiness | `test/e2e/plasmon-demo-text-language-transition.spec.ts` — `[demo profile] #415 Text classifies FileManager rename and Save As language transitions in live Monaco` — tags `@r2-quarantine @issue-415 @issue-434` | independent retry-free probes `32520634935` and `32525873804` each passed 9/10; failures occur at different pre-assertion readiness boundaries (Desktop fixture entry vs Plasmon Taskbar) before the Monaco language-transition contract is reached | #434 |

## #279 left-snap / snap-preview restoration proof

Issue #279 restores `test/e2e/plasmon-golden-path-left-snap.spec.ts` — `packaged Plasmon previews and commits left snap` — to required serialized Specialist execution. This is the restoration owner for the quarantine created under #277. The test retains `@issue-277` history and adds `@issue-279`; it no longer carries `@r2-quarantine` on the restoration head.

The restored acceptance uses the shared real-titlebar pointer helper: Playwright first establishes titlebar actionability, the helper then derives a currently hit-testable non-control point, raw mouse input establishes the production `data-interacting="drag"` lifecycle, and release waits for that lifecycle to clear. Visible left preview, preview geometry, usable-workspace containment, and committed `data-window-snap="left"` remain required.

Quarantine removal is provisional until #279's exact-head proof completes. The restoration head must remain retries=0 and pass the requested fresh 10+50 flake-probe evidence plus the Issue-required clean first-attempt Specialist evidence. Any owned red resets the restoration claim; no sleep, timeout inflation, retry-as-fix, Product hook, or geometry weakening is allowed.

## #308 Alt-Tab multi-instance restoration

Issue #308 restores `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `#63 packaged Alt-Tab consumes Windowing MRU through the real keyboard boundary` — to required serialized Specialist execution. PR #454 removed only the exact `@r2-quarantine` tag and #308 inventory entry while preserving the full Alt-Tab MRU, minimize/restore, Escape-cancel, close, and strict BrowserHealth assertions.

The shared Explorer activation repair selects the unique Desktop Root and uses the real FileManager listbox Enter boundary for both Explorer launches. It does not add sleeps, retries, timeout inflation, forced actions, weakened window-count assertions, direct Process calls, or Product test hooks.

PR #454 final head `0c97db5f2d83c119d54a6f95cc160f056d2f9d61` was approved with the exact acceptance unquarantined, the packaged Specialist job green, and ten retry-free first-attempt Flake Probe baseline executions clean, exceeding #308's required five-clean restoration proof. PR #454 merged as `922b04618fa393678cf05c18d849d63eb40a445d`. The exact #63 acceptance now carries only `@issue-63` and `@issue-308`; its independent #308 restoration lifecycle is complete.

## #251 Desktop Root Explorer sibling restoration

Issue #251 restores `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — `packaged Plasmon repeatedly opens and closes reachable Explorer siblings` — to required serialized Specialist execution. The exact restoration head `342a9f1e19482f806232ce4c33c5da2a8d43600e` preserves the real Desktop FileManager selection and Enter activation path, exact second-window and Root-address assertions, 60 close/reopen cycles, and strict browser boundaries without sleeps, retries, timeout inflation, weakened counts, or Product hooks.

Flake Probe run `32757768636` produced ten successful retries=0 baseline packets on the exact restoration head, exceeding the five-clean first-attempt requirement. The quarantine tag and inventory entry were removed for #251; #308's separate Alt-Tab restoration is recorded independently above.

The #304 quarantine is intentionally narrower than the surrounding demo-game journey. The normal packaged fixture opening, #250 coverage, #123 static artwork behavior, #202 sandbox-storage contract, and #64 save/reopen persistence acceptance remain required. Static package artwork is not an accepted substitute for #124's blob-backed saved preview.

## #320 directory-drop completion restoration

Issue #320 restores the exact `test/e2e/plasmon-drag-preview-66.spec.ts` acceptance to required Specialist execution with its real pointer path, preview stacking/hit-testing checks, and final canonical Explorer source-removal assertion unchanged.

The preserved retry-free failures reached the directory-drop operation/refresh pipeline and then surfaced `Too many concurrent frontend tool calls`. The shared #317 repair is now integrated on `release/0.1.0-r2` via PR #458 and bounds Plasmon foreground frontend-call admission at Kernel's per-caller concurrency cap, so excess move/refresh work queues rather than allowing a ninth frontend call to be rejected. #320 carries no duplicate transport fix and changes only restoration bookkeeping.

#320 remains the restoration owner until its exact unquarantined retries=0 proof completes. Any recurrence must be traced as a new event-timeline failure rather than hidden with waits or retries.

## #303 grouped Explorer chooser-title restoration

Issue #303 restores `test/e2e/plasmon-demo-review.spec.ts` — `[demo profile] #118 groups canonical Explorer processes and focuses individual members` — to required Specialist execution. The repair binds the already-created primary Explorer by stable native-window identity and waits for that same production window to publish accessible name `This Plasmon` before minimizing it. The final grouped chooser assertion remains exactly `This Plasmon; Minimized`; no sleep, retry, timeout inflation, Product hook, fallback selector, or weakened chooser assertion is introduced.

Exact repair head `af8e6e763ad7e9a75433d8a16e9d7fc92913038e` produced 10/10 clean retry-free baseline packets and 50/50 targeted characterization packets, for 60/60 clean first-attempt executions with no chooser-title recurrence. The exact #118 acceptance is therefore removed from `@r2-quarantine` while the rest of `plasmon-demo-review.spec.ts` remains required and unchanged.

## #402 taskbar context-menu geometry restoration

Issue #402 restores `taskbar context menus stay source-adjacent and expose canonical Close and alignment` as the dedicated required Specialist spec `test/e2e/plasmon-taskbar-context-menu-402.spec.ts`. The acceptance was already untagged, but commit `9e0284a10c65e2fb2ac1fd8657a1086eb03a911b` moved the containing demo-review file to profile-specific inventory, so it no longer executed in required Specialist despite the quarantine ledger describing it as restored. The dedicated split corrects only that lane identity; the demo-profile #118/#303 acceptance remains in `plasmon-demo-review.spec.ts` with its existing ownership and metadata.

The historical #402 failure remains classified as shared attempt/runtime collapse: Flake Probe `32301996596` attempt 5 failed at the first `page.goto` after shared PocketIC process loss, before taskbar/context-menu setup or any geometry assertion. The restored Specialist acceptance keeps canonical Close delegation and process disappearance, 4–10 px source gap, <=3 px item-center delta, 7 px viewport containment, left alignment at 8–12 px, status-edge <=12 px, and centered alignment <=2 px. It adds no sleeps, timeout inflation, retries, Product hooks, tolerance widening, or lifecycle weakening. Final repeated-run evidence is recorded on ledger #295.

Issue #500 supplies the neutral Markdown companion acceptance in `test/e2e/plasmon-markdown-commands-114.spec.ts`. It creates a unique Markdown resource through packaged FileManager operations and exercises Markdown commands and preview semantics without demo assets, demo filenames, query fixtures, or unrelated application state.

## #420 drag-feedback request-cancellation restoration

Issue #420 restores the three #360 acceptances in `test/e2e/plasmon-drag-feedback-360.spec.ts` to required Specialist execution. Their same-NodeId move, target-transition/invalid/cancel/unmount cleanup, destination feedback, grouped-preview/grouped-move assertions, and strict BrowserHealth remain unchanged.

Trace evidence identified the aborted `file.svg` as presentation churn on the same mounted Desktop `Root` shortcut NodeId: a transient node-target resolution failure replaced last-good `folder.svg` artwork with generic `file.svg`, and the next successful resolution restored `folder.svg`, causing Chromium to cancel the superseded request. The production repair preserves last-good artwork when node-target shortcut enrichment is temporarily unavailable while retaining deterministic fallback for new entries and direct resolver callers. No `ERR_ABORTED`, `file.svg`, or request-failure allowance is introduced.

#420 remains the restoration owner until its required exact-head unquarantined retries=0 proof completes.

## #406 Explorer-to-Desktop placement restoration

Issue #406 restores `test/e2e/plasmon-drag-placement-371.spec.ts` — `#371 Explorer to Desktop drop commits the icon where the ghost is released` — to required Specialist execution. Historical trace classification showed the #371 same-NodeId filesystem move and persisted Desktop placement were already correct; the original 47 px geometry displacement was caused by #317 runtime-concurrency error-banner contamination, and the later BrowserHealth recurrence was the separately repaired #420 presentation-lifecycle signature.

Exact unquarantined head `31c4bfd22b6b93ae1573153f940f4eb31e12ca85` completed Flake Probe run `32912928369` with 10/10 clean retry-free baseline packets and 50/50 clean targeted characterization iterations. Fast, Smoke, Specialist, Persistence, and Kernel CI were also green on that head. The acceptance retains same NodeId, filesystem parent-move authority, grab offset, drag-preview/drop-target, ghost/release geometry, committed Desktop position, existing geometry tolerances, and strict BrowserHealth; only the #406 quarantine boundary is removed.

## #330 diagnostic-selection / New Folder rename restoration

Issue #330 restores `test/e2e/plasmon-diagnostic-selection-86.spec.ts` — `#86 diagnostic text selects without stealing FileEntry drag` — to required Specialist execution. The repair observes completion of each preceding inline-rename lifecycle after Escape before starting the next FileManager create/open action, using the production rename textbox as the authoritative rendered state boundary. The original diagnostic selection, no-stolen-drag-state, and post-dismissal FileEntry drag assertions remain intact; no sleep, retry, timeout inflation, fallback assertion, Product hook, or broad quarantine is introduced.

Exact repair head `e7481f69c123fadd09b86001a278a520f7a2a4b8` produced 10/10 clean retry-free baseline packets and 50/50 targeted characterization packets, for 60/60 clean first-attempt executions in a healthy packaged environment. The exact #86 acceptance is therefore removed from `@r2-quarantine`. Restoration evidence is also recorded on ledger Issue #295.

## #391 slim Monaco worker restoration

Issue #391 restores `test/e2e/plasmon-monaco-workers-89.spec.ts` to required Specialist execution for the accepted slim r2 package. The acceptance proves that the packaged `/System/Program Files/MonacoEditor/editor.worker.js` output is authoritative, compares its bytes with the URL-safe HTTP mirror and opaque-origin preload, and proves that the opaque frame executes the real Monaco worker through a classic `blob:` Worker with message exchange and no worker errors. The live Text editor retains canonical JavaScript language state plus visible syntax tokenization under strict BrowserHealth. The URL-safe mirror is the supported R2 browser transport; direct certified HTTP exposure of the space-containing Program Files path is deferred to R3 issue #546, linked to Kernel issue #545.

The slim policy deterministically maps TypeScript/JavaScript and other Monaco worker labels to `editor.worker.js`; missing packaged source fails closed. Full language-service-worker parity is outside the slim r2 package and is FUTURE/SUPERSEDED for r2: Product parity is owned by #527 (blocked by the #526 profile/size guarantee), while #370 covers only heavyweight/on-demand runtime-delivery architecture. #391 removes only its own `@r2-quarantine`; unrelated quarantines remain unchanged.

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
- `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` — required; #251 sibling-lifetime and #63 Alt-Tab acceptances are restored and retain their complete lifecycle assertions.
- `test/e2e/plasmon-demo-monaco-packaged.spec.ts` — required.
- `test/e2e/plasmon-markdown-commands-114.spec.ts` — required; #500 provides neutral Markdown command and Preview coverage.
- `test/e2e/plasmon-monaco-workers-89.spec.ts` — required; #391 restores the slim Program Files/editor-worker/opaque-transport/JavaScript-tokenization acceptance and carries no `@r2-quarantine`.
- `test/e2e/plasmon-demo-review.spec.ts` — required; #303 restores the exact #118 grouped Explorer chooser-title acceptance with 60/60 clean first-attempt proof.
- `test/e2e/plasmon-taskbar-context-menu-402.spec.ts` — required; #402 preserves canonical Close lifecycle, source-adjacent placement, viewport clamping, and left/center alignment with the existing geometry tolerances.
- `test/e2e/plasmon-explorer-documents-405.spec.ts` — required; #405 verifies neutral Root-to-Documents activation and creates its own destination file.
- `test/e2e/plasmon-emulatorjs-proof.spec.ts` — required; #245 restores the production readiness/canvas/core-start proof while retaining loader/local-asset/network-safety coverage. The PR #417 one-off fixture-selection observation is not quarantined without independent recurrence.
- `test/e2e/plasmon-demo-game.spec.ts` — retained; only the dedicated #124/#304 saved-preview blob-readiness acceptance is quarantined. The broad #250/#123/#202/#64 demo-game journey remains required.
- `test/e2e/plasmon-drag-preview-66.spec.ts` — required; #320 restores the exact #66 acceptance with its canonical final directory-drop assertion unchanged.
- `test/e2e/plasmon-drag-feedback-360.spec.ts` — required; #420 restores the open-folder move, target-transition/invalid/cancel/unmount, and grouped multi-selection acceptances while the Desktop ghost/release-continuity acceptance remains continuously required.
- `test/e2e/plasmon-drag-placement-371.spec.ts` — required; #406 restores the exact #371 placement acceptance with 60/60 clean retry-free evidence and unchanged same-NodeId/geometry/BrowserHealth assertions.
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

For #402 specifically, `test/e2e/plasmon-taskbar-context-menu-402.spec.ts` must remain required and unquarantined with retries=0 and pass five consecutive clean first-attempt packaged Specialist executions. Canonical Close/process lifecycle, 4–10 px source adjacency, <=3 px task-item centering, 7 px viewport containment, 8–12 px left alignment, <=12 px status-edge spacing, and <=2 px centered alignment remain fail-closed.

For #406 specifically, restoration was satisfied by exact unquarantined head `31c4bfd22b6b93ae1573153f940f4eb31e12ca85`: 10/10 clean retry-free baseline packets plus 50/50 targeted characterization iterations, with same-NodeId move authority, canonical Desktop placement, grab-offset/ghost-release geometry, committed-position assertions, existing tolerances, and strict BrowserHealth unchanged.

For #420 specifically, each of the three exact #360 acceptances must be exercised **unquarantined** with retries=0 and pass five consecutive clean first-attempt packaged Specialist executions before its quarantine is removed. The canonical same-NodeId move, target-transition/invalid/cancel/unmount cleanup, destination feedback, grouped-preview/grouped-move assertions, and strict BrowserHealth must remain intact; no generic request-abort or asset allowance is an acceptable restoration.

For #391 specifically, restoration is represented by the slim r2 acceptance above; its required evidence retains packaged Program Files authority, opaque-origin `blob:` transport, real editor-worker construction/message exchange, and strict worker/page/browser-health assertions. Direct certified HTTP exposure is an R3 compatibility question tracked by #546/#545 and is not an R2 requirement. Full language-service-worker parity remains FUTURE/SUPERSEDED for r2, with Product ownership in #527 (blocked by #526) and #370 limited to architecture.

For #434 specifically, the exact #415 Text language-transition acceptance must be run **unquarantined** with retries=0 and pass a clean 10/10 fresh Flake Probe while retaining FileManager rename and Save As transitions, Monaco model identity, JavaScript/plaintext status and tokenization, reopen persistence, round-trip behavior, and strict BrowserHealth before this quarantine is removed.

No new quarantine is implied by a failed run. Preserve the evidence, classify it in #295, create/reuse the dedicated repair Issue, and add an explicit narrow quarantine change only when authorized.
