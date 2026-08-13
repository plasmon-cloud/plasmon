# r2 active implementation PR promotion audit v2

Live GitHub snapshot: 2026-08-13 after `git fetch origin --prune`. All target `release/0.1.0-r2`; none is an ancestor of integrated `f4ac3b4c`.

| PR / Issue | current head/state | packet adopted | actual tests inspected | promotion verdict |
|---|---|---|---|---|
| #204 / #191 | draft, `a4ad1b3f`, open; Fast PASS, packaged smoke/specialist FAIL before Playwright | A `1e579bf` packet; superseded guards retired | `src/os/file-manager/issue-191.characterization.test.ts`, `test/rtl/issue-191.test.tsx`, `test/e2e/plasmon-file-entry-191.spec.ts` | WAITING MERGE; geometry spec distinct from #95. Exact-head package lane is externally blocked by shared Motoko resolver Issue #161, not by #191; earlier browser run passed geometry but failed baseline health accounting. |
| #208 / #65 | ready, `6656701`, open | earlier A UI RED `d522336`, not final repaired packet | `operation-state.test.ts`, `test/rtl/issue-65-operation-progress.test.tsx` | **PARTIAL RED PROMOTION GAP**: model tests cover success/mixed/reject second start, but adapter tests still use one file for import and one item for paste; no final two-file behavioral assertions |
| #210 / #51 | ready, `b7e5a52`, open | earlier A RTL RED `d522336` | `send-to-desktop.test.ts`, `test/rtl/issue-51-send-to-desktop.test.tsx` | **STALE PACKET PROMOTED / PARTIAL GAP**: headless helper is strong, but final UI journey is one happy path and does not assert negative/identity/repeat/rename contract |
| #211 / #190 | draft, `7fae5af`, open | A `318966c` presentation/browser packet | `src/os/visual/issue-190.test.ts`, `test/e2e/plasmon-presentation-assets.spec.ts`, Shell/Properties/Explorer consumers | WAITING MERGE; current branch has real package-mounted asset request assertions, but no integrated release proof or allowance retirement |

## Current CI/review evidence

- #204 exact head has Fast Bun, Review semantic/package, Review packaged, and Kernel PASS; Plasmon packaged smoke/specialist fail before browser because shared Motoko package resolution cannot resolve the `.mops/_github/core#v2.6.0/...` path. PR comments identify canonical Issue #161 as the external repair; no #191 workaround is authorized.
- #208 all listed checks PASS, but passing CI does not strengthen its one-file adapter assertions.
- #210 all listed checks PASS, but passing CI does not strengthen its one-file UI assertion.
- #211 Fast PASS; packaged/specialist/persistence/Kernel/Review checks were pending at the poll, so no acceptance claim is made.

## No active implementation may be called integrated

PR #208/#210 are not GitHub-merged and their green tests are not in the release. PR #204/#211 are drafts. A merge, passing CI, or a current PR body cannot close the promotion row until release ancestry and durable test strength are rechecked.

## Required implementor handoff

- #65: adopt final repaired two-file import/paste packet or stronger equivalent; assert controlled pending interval, second-item observability, partial failure, alert, duplicate suppression, lifecycle cleanup, and production `FileOperationState` vocabulary.
- #51: retain final helper negative/identity/collision tests in ordinary discovery and strengthen adapter journey to prove command eligibility/errors without changing canonical shortcut authority.
- #190: after merge, run focused packaged asset request spec against a real installed session and retire only `/static/plasmon/icons/**` allowances; do not retire unrelated #67/#200/#202/Kernel warnings.
- #191: after merge, verify ordinary tests and packaged bounds; preserve #95 as a separate selected-label contract.
