# Plasmon Flake Probe

The Flake Probe records retry-free stability evidence without making every pull-request revision pay the full browser cost.

## Execution phases

### Pull-request head

Ordinary PR open/update/reopen does not run an automatic probe. The stable `Flake probe summary` context reports that pre-merge confidence is waiting for normal GitHub approval.

### Reviewer approves

A normal approving GitHub review triggers the required pre-merge confidence evidence on the PR merge ref:

- one broad `all` probe observation;
- conditionally 3 targeted Playwright characterization observations when deterministic impact selection resolves relevant scope.

The targeted 3 observations run in one prepared packet. Package/PocketIC setup is paid once for that targeted packet. All observations are retries=0.

This approval-stage evidence is a hard merge gate. If the broad observation fails, or any applicable targeted characterization observation fails, `Flake probe summary` fails and Merge remains blocked.

### Merge queue

The merge queue is intentionally fast-only. Flake Probe does not repeat browser/PocketIC work on the `merge_group` SHA. The stable summary context reports successful deferral because browser confidence already ran before the user pressed Merge.

### Integrated release push

The integrated SHA receives diagnostic post-merge analysis:

- 3 independent broad `all` observations;
- conditionally 3 targeted Playwright characterization observations.

The targeted 3 observations use one prepared packet/setup. The broad observations remain independent prepared environments until the separate PocketIC optimization work proves broad shared-state reuse safe.

Post-merge evidence is diagnostic. It cannot retroactively undo a completed merge.

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

A clean sample is evidence, not proof that a target cannot flake. An observed failure must remain visible and be classified rather than hidden with retries, sleeps, timeout inflation, broad skips, or weaker assertions.
