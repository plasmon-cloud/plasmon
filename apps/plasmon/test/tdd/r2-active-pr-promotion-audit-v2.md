# r2 active implementation PR promotion audit v2

Live GitHub snapshot: 2026-08-13 after `git fetch origin --prune`. All target `release/0.1.0-r2`; none is an ancestor of integrated `f4ac3b4c`.

| PR / Issue | current head/state | packet adopted | actual tests inspected | promotion verdict |
|---|---|---|---|---|
| #204 / #191 | draft, `a4ad1b3f`, open; Fast PASS, packaged smoke/specialist FAIL before Playwright | A `1e579bf` packet; superseded guards retired | `src/os/file-manager/issue-191.characterization.test.ts`, `test/rtl/issue-191.test.tsx`, `test/e2e/plasmon-file-entry-191.spec.ts` | WAITING MERGE; geometry spec distinct from #95. Exact-head package lane is externally blocked by shared Motoko resolver Issue #161, not by #191; earlier browser run passed geometry but failed baseline health accounting. |
| #208 / #65 | ready, `665670102efd63bbc766c5a51f1b24fcace2ced5`, open; all exact-head checks PASS | repaired A packet `d522336` / repaired tree `8453df4` | `operation-state.test.ts`, `test/rtl/issue-65-operation-progress.test.tsx`; exact source inspected against repaired `.red/issue-65.red.ui.test.tsx` | **PROMOTION ACCEPTED**: operation model has running/completed/failed, item totals/current import item, mixed-result failure, duplicate-start rejection; FileManager sequentially exposes delayed import state, preserves partial success/error, blocks duplicate triggers, and exposes paste running lifecycle without byte/per-item fabrication. FsService helpers retain write/copy/collision/identity authority. |
| #210 / #51 | ready, `b7e5a52d123d847cce98aea3e0aef2dfce20b392`, open; all exact-head checks PASS | repaired A packet `d522336` / repaired lower packet | `send-to-desktop.test.ts`, `test/rtl/issue-51-send-to-desktop.test.tsx`; exact source inspected against repaired `.red/issue-51.red.test.ts` and UI packet | **PROMOTION ACCEPTED**: helper tests cover canonical NodeId identity, unchanged source placement, repeated collision naming, protected system source, stale target, unavailable Desktop, and no partial state; implementation imports and delegates serialization to `createShortcut`, resolves `/Desktop`, and UI exposes the eligible command with deterministic error handling. |
| #211 / #190 | draft, `7fae5af`, open; Fast PASS, specialist/persistence PASS, refactor smoke FAIL | A `318966c` presentation/browser packet | `src/os/visual/issue-190.test.ts`, `test/e2e/plasmon-presentation-assets.spec.ts`, Shell/Properties/Explorer consumers | **EXECUTED PRODUCT RED / RED PROMOTION GAP**: focused installed asset test failed because required representative response status was undefined (`recycle-bin.svg`, retry `file.svg`); broad smoke also saw unallowed aborted icon requests. No allowance retirement or merge. |

## Current CI/review evidence

- #204 exact head has Fast Bun, Review semantic/package, Review packaged, and Kernel PASS; Plasmon packaged smoke/specialist fail before browser because shared Motoko package resolution cannot resolve the `.mops/_github/core#v2.6.0/...` path. PR comments identify canonical Issue #161 as the external repair; no #191 workaround is authorized.
- #208 exact head `665670102efd63bbc766c5a51f1b24fcace2ced5`: Kernel, Fast Bun (`31704920900`), packaged specialist, and packaged smoke all PASS. The older concern was resolved by source-level comparison plus executed supplemental two-file/partial-failure import assertions; the exact PR's model and delayed paste tests also pass in CI.
- #210 exact head `b7e5a52d123d847cce98aea3e0aef2dfce20b392`: Kernel, Fast Bun, packaged persistence, specialist, and smoke all PASS (`31706878739` Kernel, `31706878744` Fast Bun, `31706878719` specialist, `31706878721` persistence, `31706878736` smoke). Four headless helper tests and the RTL journey pass under the canonical happy-dom preload (local exact-head audit: `bun test --preload ./test/setupHappyDom.ts src/os/file-manager/send-to-desktop.test.ts test/rtl/issue-51-send-to-desktop.test.tsx`). The lower helper coverage is equivalent to the repaired packet's deterministic acceptance, not a source-shape requirement.
- #211 Fast PASS; specialist and persistence later PASS, but refactor smoke FAIL on the focused #190 asset/health failure. Kernel/Review checks were still pending at the last poll. The failure is real product RED at the installed asset response boundary, not a browser-session absence.

## No active implementation may be called integrated

PR #208/#210 are not GitHub-merged and their green tests are not in the release. PR #204/#211 are drafts. A merge, passing CI, or a current PR body cannot close the promotion row until release ancestry and durable test strength are rechecked.

## Required implementor handoff

- #65: **PROMOTION ACCEPTED** at exact head; no PR modification or RED staging required. The current model/adapter contract and CI are sufficient; future #92 must consume this `FileOperationState` vocabulary.
- #51: **PROMOTION ACCEPTED** at exact head; no PR modification or RED staging required. The current helper tests are the appropriate deterministic acceptance layer; no implementation-coupled source-shape assertion is required.
- #190: after merge, run focused packaged asset request spec against a real installed session and retire only `/static/plasmon/icons/**` allowances; do not retire unrelated #67/#200/#202/Kernel warnings.
- #191: after merge, verify ordinary tests and packaged bounds; preserve #95 as a separate selected-label contract.
