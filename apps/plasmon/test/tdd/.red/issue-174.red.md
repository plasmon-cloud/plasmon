# Issue #174 — repaired packet

Disposition: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**.

## Executable evidence

`issue-174.red.test.ts` now includes:

- core duplicate assertion: current `searchShell` emits two Browser results,
  friendly native plus raw `.sys` file;
- hidden/system visibility characterization through the real search API boundary;
- running/not-running-independent classification characterization;
- display-title versus unchanged filesystem name/NodeId characterization;
- canonical filesystem-result activation through `activateSearchFilesystemResult`.

The core deterministic RED reaches `searchShell` and fails only at the intended
one-result assertion. The other tests are lower-layer characterization, not
replacements for the RED.

## Remaining acceptance

The packet still needs the accepted implementation's final Search projection
vocabulary to prove Start/Search user-facing type/name consistency and the exact
hidden native-resource policy for resources such as Properties. Those are
explicitly marked incomplete until #189/#174 consumer integration exposes the
production result. No Search UI redesign or second app catalog is introduced.
