# R2 testing-system truth audit

Audit date: 2026-08-14. Release head: `4024addc4902cd019b64df548e4fb2dbf84cd053` (`release/0.1.0-r2`).

## Conclusion

**HARNESS GAP** — the shared harness and PR-triggered lanes are real and green where observed, but the release branch has no automatic post-merge Plasmon Fast CI or packaged-browser push validation. Branch protection is also absent, so the repository cannot claim that every Coordinator merge was gated by those checks.

This is a CI topology gap, not a product or test-harness implementation gap. No product behavior was changed.

## Evidence: shared harness and staging machinery

- `/home/bhare/plasmon/agents/control/HARNESS_READY` exists and explicitly names the canonical `createHeadlessPlasmonEnvironment()`, `renderPlasmon()`, RTL/user-event/Happy DOM, manifest-driven packaged/browser harness, and browser-health infrastructure.
- Release `4024add` contains the production-backed harness files:
  - `apps/plasmon/test/headlessEnvironment.ts`
  - `apps/plasmon/test/renderPlasmon.tsx`
  - `apps/plasmon/test/setupHappyDom.ts`
  - `apps/plasmon/test/headlessEnvironment.test.ts`
  - `apps/plasmon/test/rtl/renderPlasmon.test.tsx`
- `apps/plasmon/package.json` defines the real lanes:
  - `test` → `test:fast`
  - `test:fast` → Bun production/headless tests plus `test:ui`
  - `test:ui` → canonical Happy DOM/RTL preload
  - `test:package` and `test:all` for package boundaries.
- Merged PR #168 established the shared r2 harness and demo preparation. Its observed checks were successful: Fast Bun, packaged browser golden path, Review package/browser, and Kernel.
- The live queue has 42 unique issue rows: 36 `[x]` and 6 `[~]`; no `[ ]` remains after #195 reconciliation. #195 is now `[x] TDD:ALREADY GREEN` and PR #213 is merged into the release with successful Fast Bun, packaged persistence, specialist browser, refactor smoke, and Kernel checks.
- This is **not** equivalent to 42/42 completed product acceptance: `[~]` remains correct for genuine harness/external blocks under the queue protocol.

## CI topology evidence

### PR-triggered validation works

`.github/workflows/plasmon-ci.yml` has an unrestricted `pull_request` trigger and runs `npm --workspace neutron-plasmon test` when the change scope is Plasmon-relevant.

`.github/workflows/plasmon-browser-ci.yml` has a path-scoped `pull_request` trigger covering `apps/plasmon/**`, package/runtime/provisioning inputs, the manifest, Playwright configuration, and packaged Plasmon specs.

The release PR checks demonstrate the topology: merged PR #213 and merged PR #215 each reported successful Fast Bun, packaged browser persistence, packaged specialist browser, packaged refactor smoke, and Kernel checks. The separate persistence and smoke workflows are PR-only and also ran successfully on those PRs.

### Direct push to the r2 release branch does not run the two named push lanes

At release head, both named workflows contain only:

```yaml
on:
  push:
    branches:
      - version-0.1.0-os
```

Neither includes `release/0.1.0-r2`. Therefore a direct push, merge commit, or Coordinator-created commit on `release/0.1.0-r2` does not trigger either Plasmon Fast CI or Plasmon Packaged Browser CI.

The live Actions API confirms this: for release head `4024add`, there is no run for either `Plasmon Fast CI` or `Plasmon Packaged Browser CI`; the successful checks are attached to the pre-merge PR event. The packaged persistence and packaged smoke workflows are even narrower: they have `pull_request` and `workflow_dispatch`, but no `push` trigger at all.

### Silent-failure consequence

A Coordinator merge can therefore leave the release branch with no post-merge Fast Bun, packaged browser, persistence, or refactor-smoke run. A PR merge is covered only when its applicable PR checks actually ran before merge; a direct release push is not covered automatically.

### Branch protection evidence

GitHub reports:

- `GET /repos/plasmon-cloud/plasmon/branches/release%2F0.1.0-r2/protection` → `404 Branch not protected`.
- `GET /repos/plasmon-cloud/plasmon/branches/dev/protection` → `404 Branch not protected`.
- The release branch API reports `protected: false`.

Consequently, no required-status-check claim is enforced by GitHub. A PR may merge without the expected checks being present/passing, and direct pushes are permitted without post-merge validation. This does not invalidate successful observed PR evidence, but it prevents claiming mandatory r2 merge gating.

## Smallest canonical gap

Add `release/0.1.0-r2` to the `push.branches` list in both:

- `.github/workflows/plasmon-ci.yml`
- `.github/workflows/plasmon-browser-ci.yml`

Then decide explicitly whether the PR-only `plasmon-browser-persistence-ci.yml` and `plasmon-browser-smoke-ci.yml` also require release push triggers. Until that topology decision and branch-protection policy are made, classify this as **HARNESS GAP: release post-merge CI trigger/enforcement**, not as product RED and not as a browser harness gap.
