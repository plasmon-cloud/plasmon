# Public-consumption audit

Status: final pre-integration audit candidate; final integrated release commit SHA is recorded in Issue #535 after the remaining parent lands.

This record is historical release-gate evidence, not current contributor or architecture authority.

## Audited candidate

The substantive repository audit is now aligned directly to the current provenance-guard cleanup head:

```text
60a69303d90b731afcc44640961532ec9827878b
```

That exact #612 head already contains the final current-document reconciliation that had previously been carried separately by #628. The four #628 document changes are byte-for-byte identical at this head, so #628 no longer represents unique content and is intentionally removed from the dependency chain.

The candidate includes the behavioral test-identity migration, release-role CI migration, no-baseline active-provenance guard, release-neutral quarantine authority, package/version authority cleanup, production-source provenance cleanup, and the accepted current/history documentation split.

The eventual merge commit on `release/0.1.0-r2r3` will have a different commit identity. Issue #535 is the canonical place to record the final integrated release SHA after #612 lands; doing that does not require another cleanup implementation.

## Audit coverage

The whole-repository public-consumption gate covers the surfaces required by Issue #535:

- active Plasmon production source identifiers, comments, errors, diagnostics, and package-profile seams;
- deterministic, RTL, package, and Playwright test filenames, titles, tags, fixtures, selectors, snapshots/evidence identities, and inventory ownership;
- root/package scripts and package/version tests;
- quarantine and Flake Probe selection/exclusion machinery;
- GitHub Actions branch targeting, release-role policy, required browser lanes, and exact-head diagnostic behavior;
- current README/AGENTS/testing documentation and generated documentation-boundary contracts;
- current-vs-history documentation separation;
- package/profile/version metadata and compatibility values;
- product-visible release/work-item vocabulary within the active provenance scan surface.

## Provenance disposition

The cleanup tree uses `test/ci/verify-active-provenance.mjs` as the executable no-browser guard for active source, tests, CI, test tooling, package scripts, fixtures, selectors, comments, and diagnostics. The guard has no migration baseline.

Remaining work-item/release-like values are permitted only when they have durable meaning:

1. package, schema, protocol, migration, HTTP, dimension, or ordinary semantic/version values;
2. explicit historical evidence under the dedicated history boundary;
3. the machine-readable `repairIssue` field in the quarantine inventory, where GitHub ownership is the intended current metadata and executable identity remains semantic;
4. Git history and GitHub Issue/PR conversations themselves.

No active source/test filename, title, selector tag, fixture/resource identity, package script, public diagnostic, or CI lane is intentionally retained solely for an R2/R3 Issue or PR.

## Release-neutral CI and testing

The cleanup uses stable release-role/capability policy rather than concrete R2/R3 branch edits. Browser coverage is classified by semantic capability lanes, with required workflows executing the shared inventory/runners rather than maintaining release-numbered selection lists.

`@quarantine` is the fixed executable exclusion marker. `test/ci/plasmon-quarantine.json` is the current machine-readable debt authority; historical incident narrative is not executable quarantine state. Flake Probe remains diagnostic and cannot bypass quarantine or substitute for required gates.

## Package/version authority

Current package/archive identity and package-profile behavior derive from canonical package/build metadata rather than hard-coded current-release assumptions. Compatibility/schema/migration versions remain where they are real persisted or protocol contracts rather than project-management provenance.

## Documentation authority

Current architecture and contributor guidance is separated from preserved release/refactor/design evidence. Historical records retain original provenance under `apps/plasmon/docs/history/**`; they are not mechanically rewritten into false current guidance. The current #612 head includes the final coordinator-era wording cleanup and canonical testing guidance for the quarantine authority.

## Regression-preservation check

The cleanup does not remove user-visible Product behavior merely to satisfy textual scans. Test identities and CI selectors were renamed/reclassified while retaining their behavioral coverage. Production-source provenance cleanup preserved behavior and authority boundaries. Documentation cleanup changes guidance, not runtime behavior.

## Evidence carried into this audit

On the earlier exact provenance-guard tree `b302612bbaed6052c06fd81c920710d5cd1d1d79`, required parent-stack workflow evidence included:

- Plasmon Fast CI: PASS;
- Kernel CI: PASS;
- Plasmon Packaged Smoke CI: PASS;
- Plasmon Browser Persistence CI: PASS;
- Plasmon Packaged Browser CI: PASS.

The clean packaged-smoke run used a fresh Actions checkout, `npm ci`, package creation, PocketIC install/reinstall, package tests, and five passing packaged browser smoke tests. That evidence established the public-artifact path before the parent history was rewritten.

The Flake Probe is diagnostic/non-required and is not counted as a release gate.

The current audit PR is rebuilt directly on #612 so fresh PR checks bind to the current exact tree rather than stale stacked history.

## Finalization

Issue #535 remains open until:

1. #612 is integrated into `release/0.1.0-r2r3`;
2. required checks for the current cleanup/audit heads satisfy repository merge policy;
3. the final integrated `release/0.1.0-r2r3` commit SHA is recorded in Issue #535;
4. the integrated tree is confirmed to match the audited cleanup semantics and its package/install smoke evidence is accepted for that final tree.

No further cleanup implementation is planned in this audit branch. Any substantive defect discovered before finalization belongs to its owning cleanup area rather than being hidden in this gate.
