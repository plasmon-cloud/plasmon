# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters may then fail to schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

Required browser acceptance is retry-free. A test that fails once must not become green because the runner retried it.

Flake Probe terminology remains distinct:

- **workflow run** / `run_number` — one GitHub Actions run;
- **workflow run attempt** / `run_attempt` — a rerun of that workflow;
- **probe iteration** — one Flake Probe observation;
- **test retry** — runner-level retry behavior, which is disabled for required and probe evidence.

## Plasmon CI phases

The canonical mental model is documented in [`PLASMON_STAGED_CI.md`](./PLASMON_STAGED_CI.md): approval-stage CI decides correctness; pressing Merge commits the change to merging; the Merge queue is a fast final integration checkpoint; post-merge probing looks for flakiness without delaying the merge.

### Pull-request head: review readiness

`Fast Bun tests` runs the real deterministic Plasmon suite. Stable required packaged/browser, Kernel, and Flake Probe contexts are instantiated cheaply without starting Nix/PocketIC/Playwright.

This phase exists to make a PR reviewable quickly.

### Reviewer approves: required pre-merge confidence

A normal GitHub approving review triggers the expensive required confidence gates:

- `kernel`;
- `Packaged refactor smoke`;
- `Packaged Playwright specialist acceptance`;
- `Packaged browser persistence`;
- the Demo acceptance job in the packaged browser workflow;
- `Flake probe summary`.

Every required non-quarantined browser acceptance runs once through its owning lane. Flake Probe additionally runs exactly 1 broad retry-free observation and, when relevant Playwright scope is selected, 3 targeted retry-free observations in one prepared characterization packet.

The approval-stage 3 targeted observations are part of the hard confidence gate. Any failure blocks Merge.

### Merge queue: fast-only integration checkpoint

The Merge queue must not repeat the expensive package/PocketIC/browser work that already passed before the user pressed Merge. Required slow contexts report quickly on `merge_group`; `Fast Bun tests` remains the real test workload on the synthetic merge-group SHA.

A queue failure is therefore an integration/scheduling signal to investigate rather than another long flake-characterization phase.

### Integrated release branch: post-merge stability evidence

A push to the durable `release/**` branch role runs diagnostic Flake Probe evidence for the integrated SHA:

- 3 broad retry-free observations;
- conditionally 3 targeted Playwright characterization observations.

The targeted 3 observations use one prepared packet. The 3 broad observations currently use independent prepared environments until the PocketIC optimization proves one-setup broad reuse safe.

Post-merge evidence cannot retroactively undo the completed merge.

## Browser test ownership

`test/ci/plasmon-test-inventory.mjs` is the source-controlled classification for production Plasmon tests. Smoke, Specialist, Demo, and Persistence are capability lanes, not release-era filename lists.

New `test/e2e/plasmon-*.spec.*` files default to Specialist unless explicitly assigned to another capability or optional profile. Profile-specific acceptance must run only against a package profile that can truthfully provide the required capability.

## Quarantine authority

The executable quarantine authority is `test/ci/plasmon-quarantine.json`. Active execution uses the fixed `@quarantine` marker and exact semantic selector tags.

Quarantine is exact-test scoped. It must not become a suite skip, retry policy, timeout increase, or generic green-on-failure path. Unknown and non-quarantined failures remain hard failures.

## Automatic and labeled flake probing

`Plasmon Flake Probe` provides approval-stage required confidence plus diagnostic post-merge stability evidence. See [`PLASMON_FLAKE_PROBE.md`](./PLASMON_FLAKE_PROBE.md) for the detailed evidence model.

`ci:flake-probe` remains an explicit request for a fresh targeted 50-iteration exact-head diagnostic. `ci:flaky` is work/debt classification only and does not trigger the heavy diagnostic probe.
