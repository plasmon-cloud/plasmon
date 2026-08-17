# Flake Probe Required-Check Skip Example

This disposable file exists only to validate the required-check behavior introduced by PR #332.

Expected `Plasmon Flake Probe` behavior for the PR containing this file:

- the workflow starts for the pull request event;
- `Determine flake probe applicability` reports that no probe input changed;
- the expensive ten-attempt `Flake probe N/10` matrix does not run;
- the exact required job `Flake probe summary` is instantiated and shown as skipped;
- no Product code or test infrastructure is changed.

This example PR is intended to be closed after validation.
