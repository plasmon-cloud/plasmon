# Plasmon Flake Probe configuration

`plasmon-flake-probe.yml` is diagnostic CI. It does not replace or weaken the required r2 release gates.

## Probe modes

Qualifying pull-request heads retain the normal **10-iteration baseline** with the combined `all` target. When the same PR head changes a relevant non-quarantined Playwright acceptance, the workflow additionally runs a separate **50-iteration characterization** selected by `test/ci/select-plasmon-flake-characterization.mjs`.

The 10 baseline iterations and 50 characterization iterations are two independent evidence packets. They are never combined into a 60-sample result: for example, a 10/10 baseline plus a 47/50 characterization is not 57/60.

Manual `workflow_dispatch` still supports:

- `iterations=10` for the normal baseline-sized diagnostic run;
- `iterations=50` for deliberate characterization evidence;
- the existing bounded named targets such as `specialist`, `right-snap`, `monaco`, and `emulatorjs`;
- `target=exact` with a `test_file` under `test/e2e/` and optional `test_grep` expression.

Baseline, manual, and automatic characterization entries use the same exact-SHA checkout, package/provision runner, result format, and failure capture. Matrix concurrency remains bounded at ten hosted runners.

Characterization is explicitly diagnostic/non-required. Matrix entries whose mode is `characterization` are marked `continue-on-error`, while `Flake characterization summary` still parses the recorded outcomes and reports observed failures independently from the required baseline summary.

## Automatic characterization selection

For every `opened`, `reopened`, and `synchronize` pull-request event, selection is recomputed from the exact base/head diff. A persistent label is not required.

The automatic selector is deliberately narrow:

- one changed relevant Playwright spec selects that exact file;
- two or more changed relevant Playwright specs select those exact changed files as one `exact-set`;
- a changed helper/fixture may add only the Plasmon Playwright specs whose dependency graph deterministically reaches that helper through static relative imports or exact repository-path references;
- an unrelated non-Plasmon browser spec is ignored;
- Bun-only `test/e2e/**/*.test.*` files are ignored unless their dependency graph reaches `@playwright/test`;
- uncertain configuration/runner/support changes are recorded as unresolved diagnostics and **do not broaden** the 50-iteration characterization to the full Specialist inventory.

This policy was clarified during #409 implementation after a live proof run showed that a whole-Specialist fallback caused unrelated quarantined failures and excessive diagnostic cost. Automatic characterization is for the acceptance changed by the PR, not a second full browser suite.

The target is an internal `exact-set`: every selected file is passed directly to one Playwright invocation per fresh probe iteration with `--workers=1 --retries=0`.

### Unresolved support inputs

Some shared inputs can affect Playwright without identifying a safe acceptance target, including `playwright.config.ts`, the browser workflow/runner files, and a helper/fixture with no deterministically resolved Plasmon consumer.

The selector records these as `unresolved_inputs`. It does not invent a whole-Specialist 50-iteration target. If an exact changed spec is present alongside an unresolved support input, the exact changed spec is still characterized and the unresolved input remains visible in the applicability artifact.

## Quarantine is absolute

`@r2-quarantine` means the acceptance is excluded from execution. Flake Probe does not use quarantine as an opt-in diagnostic lane.

Automatic selection excludes changed or impacted acceptance files marked `@r2-quarantine`. In addition, every direct Playwright probe invocation applies:

```text
--grep-invert @r2-quarantine
```

This is defense-in-depth: even if a quarantined test reaches a selected file unexpectedly, Playwright must not execute that test. The existing Specialist runner retains the same quarantine exclusion.

If all changed Playwright acceptances are quarantined, automatic 50-iteration characterization is not applicable for those files.

The same product rule applies to the `ci:flake-probe` label work owned by #410: a label must not bypass quarantine.

## Setup lifecycle and follow-up optimization

#409 intentionally keeps the current per-iteration package/provision lifecycle so the targeting correction does not expand into a broader harness refactor.

The desired general direction is to package/provision/start expensive integration infrastructure once per repeated-test packet where safe, then repeat isolated Playwright executions against that prepared environment with an explicit cheap reset boundary for persistent state. That cross-cutting Playwright/integration-harness improvement is tracked in **#448**.

## Identity, artifacts, reruns, and summaries

Every new result records these identities separately:

- `run_number` — GitHub Actions workflow identity;
- `run_attempt` — rerun of that workflow;
- `mode` — `baseline`, `manual`, or `characterization`;
- `iteration` — fresh Flake Probe execution inside that run attempt;
- `iteration_count` — configured total, currently `10` or `50`;
- `target` and `scope` — the selected test boundary;
- `test_files_json` — the automatic exact-set file inventory when applicable.

Result, diagnostic, applicability, and summary artifact names include `run_attempt` and are not uploaded with overwrite semantics. Same-SHA reruns therefore retain the earlier attempt instead of replacing it.

A partial rerun can contain successful slots from an earlier `run_attempt` and rerun slots from a later attempt. The summarizer deterministically selects the highest `run_attempt` available for each probe iteration, while retaining superseded results as provenance.

The required `Flake probe summary` summarizes the normal 10-iteration baseline independently. `Flake characterization summary` is a separate diagnostic context for the selected 50-iteration scope. Their pass counts are never aggregated.

Each summary also writes a machine-readable `plasmon-flake-summary-v1` document with:

```text
flake_summary
  evidence_packets[]
    sha
    mode
    scope
    target
    iteration_count
    run_number
    run_attempts[]
    iteration_results[]
    superseded_results[]
```

A single summary invocation produces one independently classified packet; consumers may combine the baseline and characterization packet arrays without flattening their sample counts. Same-SHA run-attempt evidence is stronger than cross-SHA history because the code under test did not change.

Historical ten-iteration artifacts remain readable. The summarizer accepts the old `attempt=<n>` probe-slot field as a read-only legacy alias and also preserves the immediately prior `iteration=<n>` plus `run_number`/`run_attempt` result shape that omitted `iteration_count` and `scope`.

A clean `50/50` result is reported as **stability evidence for that exact SHA and selected scope, not proof that the target cannot flake**. Any observed failure remains diagnostic evidence. Retries, sleeps, timeout inflation, broad skips, and weakened assertions are not part of characterization mode.
