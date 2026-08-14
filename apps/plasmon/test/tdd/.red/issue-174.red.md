# Issue #174 — integrated closure disposition

Disposition: **COMPLETE / NO IMPLEMENTATION REQUIRED**.

See `issue-174-closure-audit.md`; the former RED test passes against integrated
release `82f176a`.

## Executable evidence

`issue-174.red.test.ts` now includes:

- core duplicate assertion: current `searchShell` emits two Browser results,
  friendly native plus raw `.sys` file;
- hidden/system visibility characterization through the real search API boundary;
- running/not-running-independent classification characterization;
- display-title versus unchanged filesystem name/NodeId characterization;
- canonical filesystem-result activation through `activateSearchFilesystemResult`.

The former core deterministic RED now reaches `searchShell` and passes the
one-result assertion. The remaining tests prove hidden policy, identity, and
canonical activation.

## Remaining acceptance

The accepted integrated Search projection vocabulary now proves the native
`.sys` uniqueness/category/identity policy. Search UI reconstruction and stable
geometry remain #193/#175 responsibilities; they must consume this result rather
than reopen #174 or create a second app catalog.
