# Issue #201 — final cleanup/deletion contract

Disposition: **BLOCKED — accepted r2 migrations are not complete**. The cleanup
contract is ready; no production deletion or implementation is made here.

Integrated release: `82f176a6`.

## Prerequisites

- #195 implementation/cutover (PR #213 active), then #196 view strategies.
- #193 Search and #194 Start cutovers; #169 reconciliation RED must be resolved
  before Start cleanup.
- #197 Shell, #199 NativeWindow, and #200 Monaco migrations where applicable.
- #190/#191/#173/#51/#65/#189/#192 are integrated and supply accepted seams.

## PRESERVE

- Any supported compatibility path, dynamic registration/import, package asset,
  Neutron/Monaco runtime path, FsService/NodeId, Association/OpenService,
  Trash, clipboard, shortcut, classification, Visual, Process/Windowing, and
  browser-health behavior.
- Tests and docs are evidence, not dead code; no coverage exclusion or weakened
  assertion may accompany cleanup.
- Legacy `gui2`/platform code remains until reachability and retirement Issues
  (#25/#26) establish safe deletion.
- Thumbnail decoder tables, media support, Neutron compatibility icon paths,
  and Monaco worker/package paths remain until their owning migrations prove
  replacements.

## CHANGE after prerequisites integrate

For each candidate, prove actual consumers including dynamic imports/registries,
land the replacement, run focused Bun/RTL/package/browser evidence, then delete
only zero-consumer superseded files/helpers/CSS. Add low-noise import-boundary
rules for documented retired paths where a deterministic lint rule is justified.
Consolidate visual tokens only when multiple migrated consumers demonstrate
shared meaning. Record every deletion and replacement in the cleanup ledger.

## UNSPECIFIED

No global file-size limit, broad token rewrite, mandatory `knip`/dependency tool,
exact lint rule, or deletion based on textual reference count alone. Tooling is
optional and must be rejected when false positives/dynamic runtime paths exceed
its value.

## Candidate status

| Candidate | Status now | Required proof |
|---|---|---|
| FileManager inline orchestration | blocked on #195 | replacement integration and full guard rerun |
| old FileEntry/local presentation helpers | partial #191/#190 migration | consumer/import graph and packaged visual proof |
| Search/Start Shell JSX/state | blocked on #193/#194/#169 | focused surface cutover and authority proof |
| old List/view CSS/helpers | blocked on #196/#173 | strategy cutover and geometry tests |
| Desktop placement compatibility exports | integrated #192 but consumers remain | import graph plus #172/#192 tests |
| resource classifier / shared Visual | canonical, never delete | authority proof says retain |
| Neutron resolver compatibility paths | active #171 boundary | installed runtime evidence |
| Monaco worker outputs/path | blocked #89/#67/#200 | package/runtime proof |
| legacy gui2/platform | blocked #25/#26 | active entrypoint reachability proof |

## Permanent tests to consume

`npm --workspace neutron-plasmon test`, focused FileManager/Shell/native-window/
Monaco suites, `test/refactorGuards.test.ts`, cross-surface open/Trash tests,
#173/#190/#191/#192 tests, packaged refactor smoke/health, and each owning
specialist browser/package gate. Cleanup must not create duplicate copies of
these guards.

## Exact RED / browser boundary / HARNESS GAP

No #201 corrective RED is truthful before migrations; cleanup is not a source-
shape test. Browser/package evidence is inherited from each owning migration and
must be rerun when deleting a package/runtime asset. No current harness gap is
identified; a dynamic reachability uncertainty is a dependency/evidence wait,
not permission to delete or invent a test-local policy.

## Forbidden modifications

Do not modify active implementation PRs, FsService schema, Trash/association/open
authority, resource classification, shared Visual authority, Process/Windowing,
Monaco runtime authority, or legacy code before its owning retirement proof.
