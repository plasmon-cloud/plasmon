# Required CI browser quarantine

Required browser CI and Flake Probe use the fixed Playwright tag `@quarantine`. [`plasmon-quarantine.json`](./plasmon-quarantine.json) records which exact semantic acceptances are authorized debt; it does not configure the quarantine tag itself.

Quarantine is exact-test debt. It does not delete a spec, skip a suite, add retries, inflate timeouts, weaken assertions, or permit unknown failures. Non-quarantined failures, environment loss, and unlisted BrowserHealth diagnostics remain hard failures.

## Active debt

| Semantic acceptance | Classification | Current repair owner | Exit requirement |
| --- | --- | --- | --- |
| `saved-jsdos-preview-publication` / `@saved-preview` — `saved js-dos resource publishes a blob-backed preview after save` | known flaky | #304 | Remove `@quarantine` before proof, run with `retries=0`, and satisfy #304's fresh exact-head restoration evidence while preserving the required blob-backed saved-preview assertion. |

The surrounding packaged js-dos open/save/reopen acceptance remains required. Static package artwork is not an accepted substitute for a successfully published saved preview.

## Adding or removing quarantine

A quarantine change must update the machine-readable inventory and the exact Playwright test together. The inventory records only current executable state: semantic identity, active state, current debt classification, repair owner, and exit criteria.

Historical workflow runs, old PR heads, previous release sequencing, and resolved incident narratives belong in the owning GitHub Issues and the current human flake ledger (currently #561), not in executable configuration.

Restoration requires deliberately removing the exact `@quarantine` marker and inventory entry before collecting retry-free evidence. Do not use retries, sleeps, blanket timeout increases, broad warning allowances, fallback pass conditions, or suite-level skips as restoration evidence.
