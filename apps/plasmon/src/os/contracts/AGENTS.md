# OS contracts agent instructions

## Authority

`contracts/**` owns shared OS vocabulary, public capability boundaries, and stable cross-subsystem identifiers.

## Rules

- Keep contracts implementation-free: no React components, repositories, concrete registries, browser storage, or Kernel transport details.
- Preserve identity separation. Filesystem nodes, logical Atoms/resources, processes, windows, and Neutron applications are distinct identities even when one operation connects them.
- Do not weaken stable identity into path/name/view identity.
- Keep the Neutron-facing contract no broader than capabilities verified in Neutron.
- Keep authorization/sharing contracts generic and preserve the accepted boundary between cross-AppScope authorization and provider-owned resource semantics.
- Do not add app-specific, game-specific, or UI-specific methods to generic contracts merely to simplify one caller.

## Change policy

A contract change is not a local refactor. Before editing, inspect all implementers, fakes/adapters, consumers, persistence implications, and tests. Prefer compatibility-preserving additions where practical; surface breaking semantic changes for explicit owner/reviewer approval.

## Validation

Update contract fakes and all affected subsystem/integration tests. Test semantics through implementations rather than asserting only TypeScript shape.
