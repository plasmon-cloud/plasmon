# Required CI browser quarantine

Required browser CI and Flake Probe use the fixed Playwright tag `@quarantine`. [`plasmon-quarantine.json`](./plasmon-quarantine.json) records which exact semantic acceptances are authorized debt; it does not configure the quarantine tag itself.

Quarantine is exact-test debt. It does not delete a spec, skip a suite, add retries, inflate timeouts, weaken assertions, or permit unknown failures. Non-quarantined failures, environment loss, and unlisted BrowserHealth diagnostics remain hard failures.

## Active debt

| Semantic acceptance | Classification | Repair ownership | Exit requirement |
| --- | --- | --- | --- |
| `saved-jsdos-preview-publication` / `@saved-preview` — `saved js-dos resource publishes a blob-backed preview after save` | known flaky | Declared by the inventory's `repairIssue` field | Remove `@quarantine` before proof, run with `retries=0`, and satisfy the inventory's fresh exact-head restoration requirement while preserving the required blob-backed saved-preview assertion. |

The surrounding packaged js-dos open/save/reopen acceptance remains required. Static package artwork is not an accepted substitute for a successfully published saved preview.

## Adding or removing quarantine

A quarantine change must update the machine-readable inventory and the exact Playwright test together. The inventory records only current executable state: semantic identity, active state, current debt classification, repair owner, and exit criteria.

Historical workflow runs, old pull-request heads, previous release sequencing, and resolved incident narratives belong in their GitHub work items or Git history, not in executable configuration or active test identity.

Restoration requires deliberately removing the exact `@quarantine` marker and inventory entry before collecting retry-free evidence. Do not use retries, sleeps, blanket timeout increases, broad warning allowances, fallback pass conditions, or suite-level skips as restoration evidence.
