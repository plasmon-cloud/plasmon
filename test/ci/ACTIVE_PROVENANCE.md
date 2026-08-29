# Active provenance policy

Active Plasmon source, tests, CI, package scripts, fixtures, selectors, diagnostics, and current documentation describe product behavior and stable architecture. GitHub work items own implementation history and coordination provenance; Git history is the repository's archive for superseded release/refactor material.

`verify-active-provenance.mjs` enforces that boundary without a browser. It scans active Plasmon source/test paths, current Plasmon documentation, repository test tooling, GitHub Actions workflow material, and package scripts for work-item-derived paths, test identities, tags, artifacts, comments, and concrete versioned release-branch coupling.

The guard has no migration baseline. New violations fail immediately.

The only bounded work-item exception is current executable debt ownership: `repairIssue` in `plasmon-quarantine.json` may identify the live GitHub repair owner while the executable quarantine selector and test identity remain semantic. Ordinary semantic, package, protocol, schema, migration, HTTP, dimension, and version numbers remain valid.

Do not encode a GitHub work item into a test filename, test title, selector tag, fixture/resource name, package script, CI lane, public diagnostic, or active architecture comment. Use behavioral names and stable configuration inputs instead.

When historical provenance is useful to a maintainer, use Git history or the owning GitHub conversation rather than preserving release/refactor archaeology as current repository documentation.
