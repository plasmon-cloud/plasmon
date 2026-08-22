# Plasmon Flake Probe configuration

`plasmon-flake-probe.yml` is diagnostic CI. It does not replace or weaken the required r2 release gates.

## Probe modes

Pull-request execution remains the baseline policy: qualifying PR heads run **10** fresh probe iterations with the combined `all` target. Issue #408 only makes count and scope configurable; it does not automatically select the 50-iteration mode for changed tests.

Manual `workflow_dispatch` supports:

- `iterations=10` for the normal baseline;
- `iterations=50` for characterization evidence;
- the existing bounded named targets such as `specialist`, `right-snap`, `monaco`, and `emulatorjs`;
- `target=exact` with a `test_file` under `test/e2e/` and optional `test_grep` expression.

The same workflow job, package/provision setup, and result format are used for 10 and 50 iterations. Matrix concurrency remains bounded at ten hosted runners; a 50-iteration characterization therefore runs in waves rather than creating fifty simultaneous package/PocketIC environments.

## Exact Playwright scope

`target=exact` accepts only an existing `test/e2e/**/*.spec.*` or `test/e2e/**/*.test.*` file from the exact checked-out ref. `test_grep` is optional and is passed to Playwright as a separate `--grep` argument; it is not evaluated by the shell.

Exact scope intentionally runs Playwright directly with `--workers=1 --retries=0`. It does **not** inherit the Specialist inventory's `--grep-invert @r2-quarantine` filter, so CI owners can characterize one explicitly selected quarantined acceptance without broadening the normal Specialist inventory. Named `specialist` and automatic `all` behavior retain the existing Specialist quarantine policy.

## Identity and artifacts

Every new result records these identities separately:

- `run_number` — GitHub Actions workflow run number;
- `run_attempt` — GitHub Actions rerun attempt;
- `iteration` — fresh Flake Probe iteration;
- `iteration_count` — configured total, currently `10` or `50`;
- `target` and `scope` — the selected test boundary.

Job names and artifact names include the configured count and scope. `result.txt` also records the full scope, exact SHA, and optional exact file/grep values.

Historical ten-iteration artifacts remain readable. The summarizer accepts the old `attempt=<n>` probe-slot field as a read-only legacy alias, treats historical results without `iteration_count` as a ten-iteration run, and does not require the new `scope` field for those legacy files. New workflow output must use `iteration=<n>` plus `iteration_count` and must never emit the legacy probe-slot field.

A clean `10/10` or `50/50` result is stability evidence for that exact SHA and scope, not proof that the test cannot flake. Any observed failure remains fail-closed diagnostic evidence; retries, sleeps, timeout inflation, broad skips, and weakened assertions are not part of the characterization mode.
