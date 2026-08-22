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

The selector records these as `unresolved_inputs`. Uncertainty **does not broaden** characterization: it does not invent a whole-Specialist 50-iteration target. If an exact changed spec is present alongside an unresolved support input, the exact changed spec is still characterized and the unresolved input remains visible in the applicability artifact.

## Quarantine is absolute

`@r2-quarantine` means the acceptance is excluded from execution. Flake Probe does not use quarantine as an opt-in diagnostic lane.

Automatic selection excludes changed or impacted acceptance files marked `@r2-quarantine`. In addition, every direct Playwright probe invocation applies:

```text
--grep-invert @r2-quarantine
```

This is defense-in-depth: even if a quarantined test reaches a selected file unexpectedly, Playwright must not execute that test. The existing Specialist runner retains the same quarantine exclusion.

If all changed Playwright acceptances are quarantined, automatic 50-iteration characterization is not applicable for those files.

The same product rule applies to the `ci:flake-probe` label work owned by #410: a label must not bypass quarantine.

## `ci:flake-probe` labeled probes

The `ci:flake-probe` label requests a fresh **50-iteration** targeted diagnostic run for the exact current PR head. It is not a second broad Specialist run and it never bypasses quarantine.

Target selection is deliberately narrow:

1. An explicit PR-body directive may name `Flake-Probe-Target: test/e2e/<file>.spec.ts` and optionally `Flake-Probe-Grep: <title-or-tag>`.
2. The bounded named direct targets `right-snap`, `left-snap`, `window-lifetime`, `monaco`, `emulatorjs`, and `saved-preview` are also accepted.
3. Without an explicit directive, the label selector may reuse #409 selection only when exactly one Playwright file is resolved.
4. If the target is absent or ambiguous, the label workflow fails closed and asks for an explicit target rather than launching fifty broad runs.

`all` and `specialist` are rejected as label targets. Every exact or named direct target reaches the shared probe runner, which applies `--workers=1 --retries=0 --grep-invert @r2-quarantine`; therefore a quarantine tag remains an absolute execution exclusion even when the containing file or named boundary is requested.

GitHub workflow dispatch requires a branch or tag as its transport ref. The label bridge therefore dispatches through the same-repository PR head branch while passing the immutable PR head SHA as the probe workflow's `ref` input. The probe checks out that exact SHA.

While the label remains present, every later `synchronize` event requests another fresh 50-iteration probe for the new exact head. Removing the label prevents future synchronize-triggered labeled probes but does not cancel a run already dispatched. Removing and re-adding the label can request another fresh probe on the same SHA.

## Prepared Playwright packet lifecycle

#448 moves expensive repeated-test infrastructure out of the individual targeted Playwright repetition. A targeted 50-iteration probe is scheduled as **10 prepared packets of 5 repetitions**. The normal 10-iteration broad baseline remains ten independent one-execution jobs, and broad `all`/`specialist` 50-run diagnostics also remain unbundled because silently serializing those larger test boundaries would change their latency and execution characteristics.

Each prepared packet uses the repository-owned `test/e2e/run-plasmon-playwright-packet.sh` lifecycle:

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

Prepared-environment reuse is the default. The package archives and installed bounded local deployment do not change between ordinary repetitions, so normal targeted tests reuse the one packet install. `test/ci/plasmon-playwright-isolation.mjs` owns the exceptional reset classification. Tests that intentionally depend on mutating durable canister/filesystem state are listed there and receive a per-repetition `plasmon:local:reinstall` reset after the first observation. At present those explicit reset-required files are `test/e2e/plasmon-persistence.spec.ts` and `test/e2e/plasmon-demo-game.spec.ts`. If an `exact-set` contains any reset-required file, the selected packet uses the stronger reinstall isolation for the whole set.

The packet runner exports `PLASMON_PLAYWRIGHT_ENV_READY=1` after setup; nested `test/ci/run-plasmon-flake-probe.sh` calls see that the environment is already ready and skip duplicate dependency install, package preparation, PocketIC startup/status, and deployment install. Direct standalone uses of the Flake runner retain the older fully fresh setup path.

Browser/test isolation remains fresh because every repetition launches a new Playwright process rather than using `--repeat-each` inside one browser worker. Persistent-state isolation is deliberately exceptional: ordinary tests pay no reinstall cost between repetitions, while tests whose acceptance contract relies on durable mutations are explicitly classified for reset. A reset failure is attributed to that specific iteration and does not silently continue as a clean observation.

This changes setup cost, not evidence identity. Five repetitions in one prepared packet still produce five independent `iteration=<n>` result records and separate failure directories. A failed packet continues through its remaining repetitions so the aggregate summary can report the complete observed iteration set. GitHub rerunning that failed packet produces a newer `run_attempt` for all five slots; the summarizer keeps the newest result per iteration and retains superseded same-SHA evidence as provenance.

The packet lifecycle is a general Plasmon Playwright/integration harness rather than a #409-only shortcut. Other repeated installed-browser checks may reuse it when sharing one prepared deployment is truthful. Tests that genuinely require durable-state reset must be added to the explicit reset classification; tests that require a newly created PocketIC process or newly packaged archive for every observation must not use the reusable packet lifecycle.

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
