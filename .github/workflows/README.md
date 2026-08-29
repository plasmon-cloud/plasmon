# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters may then fail to schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

Required browser acceptance is retry-free. A test that fails once must not become green because the runner retried it. The shared gate verifier protects fail-on-flaky behavior without launching a browser.

Flake Probe terminology remains distinct:

- **workflow run** / `run_number` — one GitHub Actions run;
- **workflow run attempt** / `run_attempt` — a rerun of that workflow;
- **probe iteration** — one fresh Flake Probe observation;
- **test retry** — runner-level retry behavior, which is disabled for required and probe evidence.

## Plasmon CI phases

CI is staged so expensive installed-package/browser work validates an approved merge candidate instead of every intermediate PR revision.

### Pull-request head: review readiness

`Fast Bun tests` runs the real deterministic Plasmon suite. Stable required packaged/browser and Flake Probe contexts are still instantiated, but their expensive Nix, package, PocketIC, and Playwright steps are explicitly deferred.

This phase exists to make a PR reviewable quickly. A green deferred context is not browser evidence; the real required browser evidence belongs to the merge-group phase.

### Merge queue: required pre-merge validation

Every required workflow subscribes to `merge_group: checks_requested` and validates the exact merge-group SHA.

Required slow contexts run their real workloads:

- `kernel`;
- `Fast Bun tests`;
- `Packaged refactor smoke`;
- `Packaged Playwright specialist acceptance`;
- `Packaged browser persistence`;
- the Demo acceptance job in the packaged browser workflow;
- `Flake probe summary`.

The required Flake Probe gate runs exactly one broad retry-free `all` observation. If deterministic impact analysis resolves relevant Playwright scope, the diagnostic characterization lane runs 10 retry-free targeted observations in one prepared packet so package/PocketIC setup is paid once.

Characterization is diagnostic and does not replace required browser acceptance.

### Integrated release branch: post-merge stability evidence

A push to the durable `release/**` branch role preserves the required release-push gates and runs heavier Flake Probe analysis for the integrated SHA:

- 10 independent broad retry-free observations;
- conditionally 50 targeted Playwright characterization observations;
- targeted 50-run characterization is packetized as 10 prepared packets × 5 observations.

Post-merge Flake Probe concurrency is keyed by integrated SHA. A later merge must not cancel stability evidence for an earlier integrated change.

## Browser test ownership

`test/ci/plasmon-test-inventory.mjs` is the source-controlled classification for production Plasmon tests. Smoke, Specialist, Demo, and Persistence are capability lanes, not release-era filename lists.

New `test/e2e/plasmon-*.spec.*` files default to Specialist unless explicitly assigned to another capability or optional profile. Profile-specific acceptance must run only against a package profile that can truthfully provide the required capability.

Do not add path-based PR skips or relevance checks that silently remove a required status context. Phase scheduling is the cost-control mechanism; test ownership remains semantic.

## Quarantine authority

The executable quarantine authority is `test/ci/plasmon-quarantine.json`. Active execution uses the fixed `@quarantine` marker and exact semantic selector tags.

Quarantine is exact-test scoped. It must not become a suite skip, retry policy, timeout increase, or generic green-on-failure path. Unknown and non-quarantined failures remain hard failures.

## Automatic and labeled flake probing

`Plasmon Flake Probe` provides required merge-group broad validation plus diagnostic stability characterization. See [`PLASMON_FLAKE_PROBE.md`](./PLASMON_FLAKE_PROBE.md) for the detailed evidence model.

`ci:flake-probe` remains an explicit request for a fresh targeted 50-iteration exact-head diagnostic. The label bridge accepts only same-repository PRs targeting the release branch role, rejects broad `all`/`specialist` requests, and preserves quarantine exclusion.

`ci:flaky` is work/debt classification only. It does not trigger the heavy diagnostic probe.
