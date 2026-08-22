# Plasmon Flake Probe configuration

`plasmon-flake-probe.yml` is diagnostic CI. It does not replace or weaken the required r2 release gates.

## Probe modes

Qualifying pull-request heads retain the normal **10-iteration baseline** with the combined `all` target. When the same PR head changes a relevant Playwright acceptance or its support, the workflow additionally runs a separate **50-iteration characterization** selected by `test/ci/select-plasmon-flake-characterization.mjs`.

The 10 baseline iterations and 50 characterization iterations are two independent evidence packets. They are never combined into a 60-sample result: for example, a 10/10 baseline plus a 47/50 characterization is not 57/60. When both modes are selected, the workflow intentionally pays the 60-run diagnostic cost in exchange for retaining both broad baseline evidence and narrowly scoped changed-test evidence.

Manual `workflow_dispatch` still supports:

- `iterations=10` for the normal baseline-sized diagnostic run;
- `iterations=50` for deliberate characterization evidence;
- the existing bounded named targets such as `specialist`, `right-snap`, `monaco`, and `emulatorjs`;
- `target=exact` with a `test_file` under `test/e2e/` and optional `test_grep` expression.

Baseline, manual, and automatic characterization entries use the same matrix implementation, exact-SHA checkout, package/provision runner, result format, and failure capture. Matrix concurrency remains bounded at ten hosted runners; a 50-iteration characterization therefore runs in waves rather than creating fifty simultaneous package/PocketIC environments.

Characterization is explicitly diagnostic/non-required. Matrix entries whose mode is `characterization` are marked `continue-on-error`, while `Flake characterization summary` still parses the recorded outcomes and fails closed when characterization observed a failure. A characterization failure therefore cannot silently turn the required `Flake probe summary` baseline check red.

## Automatic characterization selection

For every `opened`, `reopened`, and `synchronize` pull-request event, selection is recomputed from the exact base/head diff. A persistent label is not required.

The selector handles these inputs in narrowest-first order:

- a new or modified relevant `test/e2e/**/*.spec.*` file is targeted directly;
- a `test/e2e/**/*.test.*` file is targeted when its dependency graph reaches `@playwright/test`, so Bun-only tests in the same directory are not handed to Playwright;
- an explicitly repository-owned non-Plasmon browser spec from `plasmon-test-inventory.mjs` is treated as unrelated to direct Plasmon characterization;
- a modified helper/fixture under `test/e2e/**` is mapped to relevant Playwright tests through static relative-import impact analysis, including transitive relative imports;
- exact repository-path string references are also dependency edges, covering fixtures handed to a bundler/runner by paths such as `test/e2e/example.fixture.tsx` instead of JavaScript imports;
- shared configuration/runner inputs and unresolved E2E source helpers use the documented fail-closed fallback below.

The selector never executes test code merely to decide what CI should run. Imports and exact repository-path literals are repository-controlled static evidence only.

The target is an internal `exact-set`: every selected file is passed directly to one Playwright invocation per fresh probe iteration. This avoids multiplying package/PocketIC setup by the number of impacted files while still running the entire selected set with `--workers=1 --retries=0`.

### Shared-support fallback

When a changed shared input can affect Playwright execution but a narrower impacted Plasmon set cannot be determined safely, characterization falls back to the complete current Specialist file inventory from `plasmon-test-inventory.mjs`. The fallback covers `playwright.config.ts`, the Plasmon browser workflow/runner/inventory files, the Flake Probe workflow/runner/selector, deleted known shared helpers, and **any changed `test/e2e/**` source helper or fixture whose Plasmon impact cannot be resolved**. Filename prefixes are not treated as ownership proof.

This includes non-`plasmon-*` fixture names such as `permission-dialog.fixture.tsx`: if the selector cannot resolve a safe Plasmon target for such a changed helper, it must fall back rather than silently omit the 50-iteration characterization request.

If a PR also directly changes a Playwright test, that file is unioned into the fallback set. The fallback therefore cannot silently drop a new or modified quarantined acceptance merely because normal Specialist execution applies `--grep-invert @r2-quarantine`.

The fallback is intentionally exceptional. Ordinary test-file changes and helpers with a determinable impact set do **not** run the whole Specialist inventory 50 times.

## Exact Playwright scope and quarantine

Manual `target=exact` accepts only an existing `test/e2e/**/*.spec.*` or `test/e2e/**/*.test.*` file from the exact checked-out ref. `test_grep` is optional and is passed to Playwright as a separate `--grep` argument; it is not evaluated by the shell.

Automatic `exact-set` and manual `exact` scopes run Playwright directly with `--workers=1 --retries=0`. They do **not** inherit the Specialist inventory's `--grep-invert @r2-quarantine` filter. Named `specialist` and the 10-iteration `all` baseline retain the existing Specialist quarantine policy.

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

A partial rerun can contain successful slots from an earlier `run_attempt` and rerun slots from a later attempt. The summarizer deterministically selects the highest `run_attempt` available for each probe iteration, while retaining superseded results as provenance. It reports the per-iteration run-attempt mapping instead of pretending the combined packet came from one attempt.

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

Historical ten-iteration artifacts remain readable. The summarizer accepts the old `attempt=<n>` probe-slot field as a read-only legacy alias and also preserves the immediately prior `iteration=<n>` + `run_number`/`run_attempt` result shape that omitted `iteration_count` and `scope`. Missing `iteration_count` is the historical ten-iteration migration boundary, and missing historical scope falls back to `target`. New workflow output always uses explicit `mode`, `iteration_count`, scope, `run_number`, and `run_attempt`.

A clean `50/50` result is reported as **stability evidence for that exact SHA and selected scope, not proof that the target cannot flake**. Any observed failure remains fail-closed diagnostic evidence. Retries, sleeps, timeout inflation, broad skips, and weakened assertions are not part of the characterization mode.
