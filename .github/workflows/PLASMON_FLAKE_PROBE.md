# Plasmon Flake Probe configuration

`plasmon-flake-probe.yml` is diagnostic CI. It does not replace, satisfy, bypass, or weaken required release gates.

## Probe modes

Qualifying pull-request heads retain the normal **10-iteration baseline** with the combined `all` target. When the same PR head changes a relevant non-quarantined Playwright acceptance, the workflow may additionally run a separate **50-iteration characterization** selected by `test/ci/select-plasmon-flake-characterization.mjs`.

The baseline and characterization are independent evidence packets. They are never flattened into one sample count.

Manual `workflow_dispatch` supports baseline-sized and characterization-sized runs, bounded named targets, and `target=exact` with a `test_file` under `test/e2e/` plus an optional `test_grep` expression.

Baseline, manual, and automatic characterization entries use exact-SHA checkout, the same package/provision runner, the same result format, and the same failure capture. Matrix concurrency remains bounded.

Characterization is diagnostic/non-required. Characterization matrix entries may continue after an observed failure so the dedicated characterization summary can classify the full packet; required baseline and product gates remain strict.

## Automatic characterization selection

For every supported pull-request event — `opened`, `reopened`, and `synchronize` — selection is recomputed from the exact base/head diff. A persistent label is not required.

The automatic selector is deliberately narrow:

- one changed relevant Playwright spec selects that exact file;
- multiple changed relevant Playwright specs select those exact changed files as one `exact-set`;
- a changed helper/fixture may add only Plasmon Playwright specs whose dependency graph deterministically reaches that helper through static relative imports or exact repository-path references;
- unrelated non-Plasmon browser specs are ignored;
- Bun-only `test/e2e/**/*.test.*` files are ignored unless their dependency graph reaches `@playwright/test`;
- uncertain configuration/runner/support changes are recorded as unresolved diagnostics and do not broaden the characterization to the full Specialist inventory;
- profile-specific acceptances are deferred to the package lane that can truthfully execute them rather than being characterized against the slim/local package.

The selected internal `exact-set` passes every selected file directly to one Playwright invocation per fresh probe iteration with `--workers=1 --retries=0`.

### Unresolved support inputs

Some shared inputs can affect Playwright without identifying a safe acceptance target, including `playwright.config.ts`, browser workflow/runner files, and helpers/fixtures with no deterministically resolved Plasmon consumer.

The selector records these as `unresolved_inputs`. Uncertainty does not invent a broad characterization target. If an exact changed spec is present alongside an unresolved support input, the exact changed spec is still characterized and the unresolved input remains visible in the applicability artifact.

## Quarantine is absolute

`@quarantine` means the exact acceptance is excluded from execution. The machine-readable authority is `test/ci/plasmon-quarantine.json`; semantic selector tags identify the bounded debt inside the containing spec.

Automatic selection excludes quarantined acceptances. Every direct Playwright probe invocation also applies:

```text
--grep-invert @quarantine
```

This is defense-in-depth: even if a quarantined test reaches a selected file unexpectedly, Playwright must not execute that test. Required browser runners retain the same exclusion.

If all changed Playwright acceptances are quarantined, automatic characterization is not applicable for those files.

## `ci:flake-probe` labeled probes

The `ci:flake-probe` label requests a fresh **50-iteration** targeted diagnostic run for the exact current PR head. It is not a second broad Specialist run and it never bypasses quarantine.

The label bridge accepts only same-repository pull requests whose base branch has the release role. That security boundary is checked before any PR code is checked out. The workflow then checks out the immutable PR head SHA for target selection.

Target selection is deliberately narrow:

1. An explicit PR-body directive may name `Flake-Probe-Target: test/e2e/<file>.spec.ts` and optionally `Flake-Probe-Grep: <title-or-tag>`.
2. Documented bounded named direct targets are accepted.
3. Without an explicit directive, the label selector may reuse automatic selection only when exactly one Playwright file is resolved.
4. If the target is absent or ambiguous, the label workflow fails closed rather than launching a broad 50-run sweep.

Broad `all` and `specialist` label targets are rejected. Every exact or named direct target reaches the shared probe runner with `--workers=1 --retries=0 --grep-invert @quarantine`.

GitHub workflow dispatch requires a branch or tag as its transport ref. The label bridge therefore dispatches through the same-repository PR head branch while passing the immutable PR head SHA as the probe workflow's `ref` input. The probe checks out that exact SHA.

While the label remains present, every later `synchronize` event requests another fresh probe for the new exact head. Removing the label prevents future synchronize-triggered labeled probes but does not cancel a run already dispatched. Removing and re-adding the label can request another fresh probe on the same SHA.

## Prepared Playwright packet lifecycle

Targeted characterization uses prepared packets so dependency installation, package preparation, PocketIC startup, and the initial installation are not redundantly repeated for every observation when reuse is truthful.

The repository-owned `test/e2e/run-plasmon-playwright-packet.sh` lifecycle is:

```text
packet setup, once
  npm ci
  -> plasmon:local:prepare
  -> plasmon:local:serve
  -> PocketIC readiness + plasmon:local:status
  -> plasmon:local:reinstall
  -> mark the Playwright environment ready

for each repetition
  if selected test scope requires persistent-state reset:
    plasmon:local:reinstall
  -> fresh Playwright process with workers=1, retries=0
  -> exact per-iteration result + diagnostics

packet teardown, once
  stop/wait for the packet PocketIC process
```

Prepared-environment reuse is the default. `test/ci/plasmon-playwright-isolation.mjs` owns the exceptional reset classification for acceptances that intentionally mutate durable canister/filesystem state. If an `exact-set` contains any reset-required file, the packet uses the stronger reinstall isolation for the whole set.

Every repetition still launches a new Playwright process. Reusing package/deployment setup changes setup cost, not evidence identity. A reset failure is attributed to that specific iteration and does not silently continue as a clean observation.

## Identity, artifacts, reruns, and summaries

Every new result records these identities separately:

- `run_number` — GitHub Actions workflow identity;
- `run_attempt` — rerun of that workflow;
- `mode` — baseline, manual, or characterization;
- `iteration` — fresh Flake Probe execution inside that run attempt;
- `iteration_count` — configured total;
- `target` and `scope` — selected test boundary;
- `test_files_json` — automatic exact-set file inventory when applicable.

Result, diagnostic, applicability, and summary artifact names include `run_attempt` and are not uploaded with overwrite semantics. Same-SHA reruns therefore retain earlier evidence instead of replacing it.

A partial rerun can contain successful slots from an earlier `run_attempt` and rerun slots from a later attempt. The summarizer deterministically selects the highest `run_attempt` available for each probe iteration while retaining superseded results as provenance.

The required `Flake probe summary` summarizes the normal baseline independently. `Flake characterization summary` is a separate diagnostic context for the selected characterization scope. Their pass counts are never aggregated.

Historical result shapes remain readable by the summarizer, but new output must use the current unambiguous fields.

A clean probe is stability evidence for that exact SHA and selected scope, not mathematical proof that the target cannot flake. Any observed failure remains diagnostic evidence. Retries, sleeps, timeout inflation, broad skips, and weakened assertions are not part of characterization mode.