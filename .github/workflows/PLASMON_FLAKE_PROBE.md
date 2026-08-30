# Plasmon Flake Probe

The Flake Probe records retry-free stability evidence without making every pull-request revision pay the full diagnostic cost.

## Execution phases

### Pull-request head

The stable `Flake probe summary` context is instantiated for review readiness, but probe execution is deferred. No automatic broad or characterization matrix runs on the ordinary PR head.

An explicit `ci:flake-probe` request remains available when a targeted heavy diagnostic is intentionally needed before merge.

### Merge queue

The exact `merge_group` SHA receives required pre-merge stability validation:

- one broad `all` probe observation;
- conditionally 10 targeted Playwright characterization observations when deterministic impact selection resolves relevant scope.

The 10 targeted observations run in one prepared packet. Package/PocketIC setup is paid once; only explicitly registered persistent-state-mutating acceptances pay per-observation reinstall/reset.

The broad `Flake probe summary` is required. `Flake characterization summary` remains diagnostic.

### Integrated release push

The integrated SHA receives heavier post-merge analysis:

- 10 independent broad `all` observations;
- conditionally 50 targeted Playwright characterization observations.

Targeted 50-run characterization uses 10 prepared packets × 5 observations. The post-merge concurrency key includes the integrated SHA so a later merge cannot cancel earlier evidence.

## Target selection

Automatic characterization uses `test/ci/select-plasmon-flake-characterization.mjs` as the impact authority. It selects exact changed Playwright files or statically resolved Plasmon consumers. Uncertain shared inputs fail closed rather than broadening into a whole-Specialist characterization sweep.

Quarantine is absolute. Fully quarantined acceptance is excluded from automatic selection, and every direct Playwright probe uses `--grep-invert @quarantine`.

Profile-specific acceptance is never run against an untruthful package. If the selected scope is profile-only, characterization uses the demo/full-profile deployment. Mixed ordinary/profile impact characterizes the truthful ordinary local scope while the real Demo required gate covers the profile-specific neighbor.

## Explicit `ci:flake-probe` diagnostics

The label bridge requests a fresh targeted 50-iteration probe for the exact PR head. It accepts either:

- `Flake-Probe-Target: test/e2e/<file>.spec.ts`, optionally with `Flake-Probe-Grep: <title-or-tag>`; or
- a documented bounded named target.

Without an explicit directive, the label may infer a target only when exactly one non-quarantined Playwright file resolves. Ambiguous or unresolved selection fails closed. Broad `all` and `specialist` 50-run label requests are rejected.

Removing the label stops future synchronize-triggered requests; it does not cancel evidence already dispatched for an earlier exact SHA.

## Evidence semantics

Every result records exact SHA, mode, scope, target, configured iteration count, workflow run number, workflow run attempt, and probe iteration.

A clean sample is evidence, not proof that a target cannot flake. Broad and characterization packets remain independent evidence sets. An observed failure must remain visible and be classified rather than hidden with retries, sleeps, timeout inflation, broad skips, or weaker assertions.

The mature summarizer remains authoritative for the established 10-baseline and 50-characterization evidence shapes, including same-SHA partial-rerun reconciliation and detailed failure extraction. `summarize-plasmon-flake-evidence.mjs` adds the smaller merge-queue 1/10 evidence shapes and delegates mature shapes to that existing authority.
