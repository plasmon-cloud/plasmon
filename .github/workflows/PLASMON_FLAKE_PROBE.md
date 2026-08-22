# Plasmon Flake Probe configuration

`plasmon-flake-probe.yml` is diagnostic CI. It does not replace or weaken the required r2 release gates.

## Probe modes

Qualifying pull-request heads retain the normal **10-iteration baseline** with the combined `all` target. When the same PR head changes a relevant Playwright acceptance or its support, the workflow additionally runs a separate **50-iteration characterization** selected by `test/ci/select-plasmon-flake-characterization.mjs`.

Manual `workflow_dispatch` still supports:

- `iterations=10` for the normal baseline-sized diagnostic run;
- `iterations=50` for deliberate characterization evidence;
- the existing bounded named targets such as `specialist`, `right-snap`, `monaco`, and `emulatorjs`;
- `target=exact` with a `test_file` under `test/e2e/` and optional `test_grep` expression.

Baseline, manual, and automatic characterization entries use the same matrix job, exact-SHA checkout, package/provision runner, result format, and failure handling. Matrix concurrency remains bounded at ten hosted runners; a 50-iteration characterization therefore runs in waves rather than creating fifty simultaneous package/PocketIC environments.

## Automatic characterization selection

For every `opened`, `reopened`, and `synchronize` pull-request event, selection is recomputed from the exact base/head diff. A persistent label is not required.

The selector handles these inputs:

- a new or modified relevant `test/e2e/**/*.spec.*` file is targeted directly;
- a `test/e2e/**/*.test.*` file is targeted when its static import graph reaches `@playwright/test`, so Bun-only tests in the same directory are not handed to Playwright;
- an explicitly repository-owned non-Plasmon browser spec from `plasmon-test-inventory.mjs` is treated as unrelated to the Plasmon probe;
- a modified helper/fixture under `test/e2e/**` is mapped to the relevant Playwright tests that statically import it, including transitive relative imports;
- shared Playwright configuration and runner/inventory/workflow files use the documented fallback below.

This is deliberately a static relative-import impact analysis: it follows source-controlled relative imports only and never executes test code merely to decide what CI should run.

The target is an internal `exact-set`: every selected file is passed directly to one Playwright invocation per fresh probe iteration. This avoids multiplying package/PocketIC setup by the number of impacted files while still running the entire selected set with `--workers=1 --retries=0`.

### Shared-support fallback

When a changed shared input can affect Playwright execution but a narrower impacted set cannot be determined safely, characterization falls back to the complete current Specialist file inventory from `plasmon-test-inventory.mjs`. The fallback is currently used for `playwright.config.ts`, the Plasmon browser workflow/runner/inventory files, the Flake Probe workflow/runner/selector, and a changed Plasmon-prefixed E2E helper whose static import impact cannot be resolved.

If a PR also directly changes a Playwright test, that file is unioned into the fallback set. The fallback therefore cannot silently drop a new or modified quarantined acceptance merely because normal Specialist execution applies `--grep-invert @r2-quarantine`.

The fallback is intentionally exceptional. Ordinary test-file changes and helpers with a determinable impact set do **not** run the whole Specialist inventory 50 times.

## Exact Playwright scope and quarantine

Manual `target=exact` accepts only an existing `test/e2e/**/*.spec.*` or `test/e2e/**/*.test.*` file from the exact checked-out ref. `test_grep` is optional and is passed to Playwright as a separate `--grep` argument; it is not evaluated by the shell.

Automatic `exact-set` and manual `exact` scopes run Playwright directly with `--workers=1 --retries=0`. They do **not** inherit the Specialist inventory's `--grep-invert @r2-quarantine` filter. Named `specialist` and the 10-iteration `all` baseline retain the existing Specialist quarantine policy.

## Identity, artifacts, and summaries

Every new result records these identities separately:

- `run_number` — GitHub Actions workflow run number;
- `run_attempt` — GitHub Actions rerun attempt;
- `mode` — `baseline`, `manual`, or `characterization`;
- `iteration` — fresh Flake Probe iteration;
- `iteration_count` — configured total, currently `10` or `50`;
- `target` and `scope` — the selected test boundary;
- `test_files_json` — the automatic exact-set file inventory when applicable.

Job names and artifact names include mode, configured count, and scope. The required `Flake probe summary` continues to summarize the normal 10-iteration baseline independently. `Flake characterization summary` is a separate diagnostic context for the 50-iteration automatic probe and does not alter the existing r2 required-gate contract.

Historical ten-iteration artifacts remain readable. The summarizer accepts the old `attempt=<n>` probe-slot field as a read-only legacy alias, treats historical results without `iteration_count` or `mode` as a ten-iteration baseline, and does not require the new scope fields for those legacy files. New workflow output uses `iteration=<n>` plus explicit GitHub `run_number`/`run_attempt`; it never reuses `attempt` for a probe iteration.

A clean `50/50` result is reported as **stability evidence for that exact SHA and selected scope, not proof that the target cannot flake**. Any observed failure remains fail-closed diagnostic evidence. Retries, sleeps, timeout inflation, broad skips, and weakened assertions are not part of the characterization mode.
