# Active provenance policy

Active Plasmon source, tests, CI, package/build metadata, scripts, fixtures, selectors, diagnostics, and current documentation describe product behavior and stable architecture. GitHub work items own implementation history and coordination provenance; Git history is the repository's archive for superseded release/refactor material.

`verify-active-provenance.mjs` enforces that boundary without a browser. It scans active Plasmon production/source/test paths, build and package metadata, current Plasmon documentation, repository test tooling, GitHub Actions workflow material, and package scripts for work-item-derived paths, test identities, tags, artifacts, comments, standalone R2/R3 release-era tokens, and concrete versioned release-branch coupling.

The guard has no migration baseline. New violations fail immediately.

## Explicit legitimate classifications

Permitted work-item/release-era occurrences are not an implicit grandfathered allowlist. The verifier owns an explicit, executable disposition inventory and prints it on every successful run. Every classified exception must be narrowly identified and justified; an unclassified occurrence fails the scan.

The current inventory is intentionally limited to:

- the provenance guard's own negative-test source, which constructs synthetic Issue/PR and old release specimens solely to prove the permanent scanner rejects them; and
- the single machine-readable `repairIssue` field in `test/ci/plasmon-quarantine.json`, which identifies the live GitHub repair owner while the executable quarantine selector, test title, tag, and CI behavior remain semantic and release-neutral.

The quarantine classification is occurrence-checked: the verifier requires exactly one matching line in the declared file. If the owner disappears, duplicates, or moves, the classification check fails rather than silently broadening the exception.

Ordinary semantic, package, protocol, schema, migration, HTTP, dimension, and version numbers remain valid. Generic release policy such as `release/**` also remains valid because it describes a durable branch role rather than a concrete historical release branch.

Do not encode a GitHub work item into a test filename, test title, selector tag, fixture/resource name, package script, CI lane, public diagnostic, or active architecture comment. Use behavioral names and stable configuration inputs instead.

When historical provenance is useful to a maintainer, use Git history or the owning GitHub conversation rather than preserving release/refactor archaeology as current repository documentation.
