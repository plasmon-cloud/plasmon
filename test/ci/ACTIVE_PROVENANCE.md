# Active provenance policy

Active Plasmon source, tests, CI, package scripts, fixtures, selectors, and diagnostics describe product behavior and stable architecture. GitHub work items own implementation history and coordination provenance.

`verify-active-provenance.mjs` enforces that boundary without a browser. It scans active Plasmon source/test paths, repository test tooling, GitHub Actions workflow material, and package scripts for work-item-derived paths, test identities, tags, artifacts, comments, and concrete versioned release-branch coupling.

The guard has no migration baseline. New violations fail immediately.

Narrow exceptions are explicit:

- material under a dedicated `docs/history` boundary is historical evidence rather than active authority;
- the Luna post-refactor reconciliation document is retained as one explicitly named historical evidence file;
- `repairIssue` in `plasmon-quarantine.json` is current machine-readable debt ownership, while the executable quarantine selector and test identity remain semantic;
- ordinary semantic, package, protocol, schema, migration, HTTP, dimension, and version numbers remain valid.

Do not encode a GitHub work item into a test filename, test title, selector tag, fixture/resource name, package script, CI lane, public diagnostic, or active architecture comment. Use behavioral names and stable configuration inputs instead.

When a historical reference is useful to a maintainer, put that history in the owning GitHub conversation or an explicit historical document rather than active executable identity.
