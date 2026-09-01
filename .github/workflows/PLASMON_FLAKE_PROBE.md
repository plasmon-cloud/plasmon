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

## Probe modes

Probe mode controls **when and how much evidence is collected**, not the quality of the summary.

- `merge-validation` is the approval-stage broad probe.
- `baseline` is the integrated release broad probe.
- `characterization` is targeted repeated evidence for deterministically selected Playwright scope.
- `manual` is an explicitly dispatched diagnostic probe.

All four modes use the same canonical human/machine summarizer. A 1-iteration approval probe must identify and classify a failing test just as clearly as a 3-, 10-, or 50-iteration probe. Iteration counts are secondary metadata; they are never a substitute for naming what failed.

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

## Summary contract

The summary is primarily a diagnostic answer for humans and coding agents. When a probe fails, the useful first question is **what failed and how confidently can the repository relate that failure to this PR?** A line such as `0/1` or `8/10` is only supporting evidence and belongs under probe metadata.

Every applicable probe mode therefore uses the same mature failure parser. For every uniquely failing test that can be parsed, the summary records:

1. the exact test file and Playwright `line:column` when available;
2. objective PR file relation: `CHANGED IN PR` or `UNCHANGED IN PR`;
3. deterministic relatedness: `DIRECT`, `STRONG`, `RELATED`, or `UNKNOWN`;
4. the evidence supporting that relatedness classification;
5. occurrence count and the probe iterations where the failure appeared.

The machine-readable `summary.json` carries the same failure identities, classifications, evidence, and iteration provenance as the human step summary.

### Objective PR relation

`CHANGED IN PR` and `UNCHANGED IN PR` are facts derived only from the PR changed-file set. They do not themselves decide whether a failure is caused by the PR.

For example, an unchanged Search acceptance can still fail because the PR changed Search implementation. Conversely, changing an acceptance file does not prove the product change caused the observed failure.

For non-PR events such as integrated release pushes or ordinary manual probes, the summary reports `PR RELATION N/A` instead of inventing a PR relationship.

### Deterministic relatedness

Relatedness is deliberately discrete. The summarizer does not use AI, probabilities, fuzzy text similarity, or a synthetic `0-100` confidence score.

| Relatedness | Emitted only when the repository can establish |
| --- | --- |
| `DIRECT` | The exact failing Playwright location overlaps a line changed by the PR. This is intentionally strict; if the summarizer cannot prove exact overlap it falls back to a weaker classification. |
| `STRONG` | The failing test file changed, or the retained failure output directly references another file changed by the PR. |
| `RELATED` | The failing E2E test statically imports, directly or transitively, changed E2E support code. |
| `UNKNOWN` | None of the deterministic relationships above can be established confidently. |

There is intentionally **no `UNRELATED` classification**. Failure to prove a relationship is not proof that the failure is unrelated or flaky. `UNKNOWN` must remain a valid and common answer.

A representative failure summary is:

```text
### Failure summary

- **UNCHANGED IN PR** `test/e2e/plasmon-search-geometry.spec.ts:99:1`
  - Test: `Search › preserves geometry`
  - Relatedness: **UNKNOWN**
  - Occurrences: 1; probe iteration(s): 1
  - Evidence: no deterministic relationship to the PR was established; UNKNOWN does not mean unrelated or flaky

### Probe metadata

- Probe mode: `merge-validation`
- Retry-free passes: 0/1
```

If the PR directly changed the failing location, the same summary instead reports `CHANGED IN PR` and `DIRECT`. If the test itself stayed unchanged but its failure stack/output names a changed source file, it reports `UNCHANGED IN PR` and `STRONG`.

## Evidence semantics

Every result records exact SHA, mode, scope, target, configured iteration count, workflow run number, workflow run attempt, and probe iteration. Failed iteration-result artifacts also retain the bounded probe command output needed by the canonical summarizer, while the existing dedicated diagnostics artifact continues to retain the richer browser/PocketIC evidence.

A clean sample is evidence, not proof that a target cannot flake. An observed failure must remain visible and be classified rather than hidden with retries, sleeps, timeout inflation, broad skips, or weaker assertions.
