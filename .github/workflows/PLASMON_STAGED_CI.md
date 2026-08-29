# Plasmon staged CI lifecycle

Plasmon CI separates review readiness, required pre-merge validation, and post-merge stability analysis so expensive browser work runs at the point where it provides the most value.

| Phase | Required behavior | Flake Probe behavior |
| --- | --- | --- |
| Pull-request head | Fast deterministic tests run; expensive required browser contexts report explicit deferral | automatic probe execution deferred |
| Merge queue | real required package/browser/kernel workloads run against the exact merge-group SHA | 1 broad retry-free observation; conditional 10 targeted observations in one prepared packet |
| Integrated `release/**` push | required release-push gates run against the integrated tree | 10 broad observations; conditional 50 targeted observations in 10 × 5 prepared packets |
| Explicit diagnostic | normal phase behavior is unchanged | `ci:flake-probe` requests a targeted exact-head 50-observation diagnostic |

`ci:flaky` remains classification/debt metadata and does not trigger the heavy probe.

Profile-specific Playwright characterization must use a package profile that can truthfully execute the selected acceptance. Quarantine remains exact-test scoped through the fixed `@quarantine` marker, and probe evidence remains retry-free.

See [`README.md`](./README.md) for required-status ownership and [`PLASMON_FLAKE_PROBE.md`](./PLASMON_FLAKE_PROBE.md) for the detailed evidence model.
