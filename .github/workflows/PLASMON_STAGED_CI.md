# Plasmon staged CI lifecycle

Issue #594 changes **when** expensive validation runs without weakening the underlying test contracts.

## 1. Ordinary pull-request head: review readiness

Every PR still reports the stable required status contexts. The fast deterministic Plasmon lane runs normally. Packaged browser and automatic Flake Probe contexts report an explicit deferred result and do not install Nix, start PocketIC, or launch Playwright on the PR head.

The intended GitHub state after this phase is green fast/readiness checks with review approval as the remaining human requirement.

## 2. Approved merge queue: pre-merge slow validation

Required workflows subscribe to `merge_group: checks_requested` and validate the exact merge-group SHA produced by GitHub.

- Required packaged Smoke, Specialist, Persistence, Kernel, and fast contexts run their real workloads.
- `Flake probe summary` is required and is backed by exactly **1** retry-free broad `all` probe.
- When deterministic impact selection finds relevant Playwright scope, characterization runs exactly **10** retry-free repetitions.
- Those 10 repetitions use **one prepared packet** so package/PocketIC setup is paid once. Only registered persistent-state tests pay per-repetition reinstall/reset.
- Characterization remains diagnostic rather than a required merge status.
- Profile-only Playwright scope is characterized against the demo/full-profile deployment. Mixed ordinary/profile scope characterizes the truthful ordinary local target and leaves the profile-specific neighbors to the real Demo gate rather than running them against the wrong package.

Do not enable the repository merge queue until every required status context has landed with `merge_group` support.

## 3. Integrated release branch: post-merge stability analysis

A push to the durable `release/**` branch role runs the heavy diagnostic policy once for the integrated SHA:

- **10** broad `all` probe observations;
- conditionally **50** targeted Playwright characterization observations;
- targeted 50-run characterization remains packetized as 10 prepared packets × 5 repetitions.

The post-merge run is diagnostic evidence. It cannot undo the completed merge. Its concurrency identity includes the integrated SHA so a later merge cannot cancel evidence for an earlier one.

Required browser release-push gates remain intact; the 10/50 analysis is additional stability evidence rather than a replacement for them.

## 4. Explicit heavy diagnostics

`ci:flake-probe` remains the explicit exact-head targeted 50-iteration diagnostic request. `ci:flaky` remains work/debt classification and does not itself trigger the heavy probe.

All probe and characterization evidence remains `retries=0`, preserves `workers=1` where required, excludes the fixed `@quarantine` selector, and records exact SHA/iteration identity.

## Expected counts

| Phase | Broad probe | Automatic targeted characterization |
| --- | ---: | ---: |
| Ordinary PR head | deferred | deferred |
| Merge queue, no Playwright impact | 1 | 0 |
| Merge queue, Playwright impact | 1 | 10 in one prepared packet |
| Integrated release push, no Playwright impact | 10 | 0 |
| Integrated release push, Playwright impact | 10 | 50, packetized 10 × 5 |
| Explicit `ci:flake-probe` | targeted manual policy | 50 targeted |

## Ruleset cutover

After this workflow support is merged and a controlled test proves required contexts report on `merge_group`, enable **Require merge queue** in repository ruleset `Require checks`. Preserve one approval, stale-review dismissal, latest-push approval, and review-thread resolution. Start with queue group size 1 and build concurrency 1 so each slow validation run remains attributable to one PR.
