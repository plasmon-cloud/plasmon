# Documentation review fingerprints

Plasmon documentation boundaries use machine-managed review fingerprints to make implementation drift visible and to require documentation maintenance alongside owned implementation changes.

The boundary inventory in `documentation-boundaries.json` assigns implementation files to their nearest declared documentation boundary. A nested boundary owns its own subtree, so a change under a child boundary does not mechanically stale every ancestor README.

## Inspect status

From the repository root:

```sh
npm --workspace neutron-plasmon run docs:review:status
```

A stale boundary reports representative owned implementation files, the owning documentation that must be maintained, and the command used to review that boundary.

## Documentation edit requirement

An owned implementation change must be accompanied by a committed real content edit to that boundary's owning documentation before its review fingerprint can be refreshed.

- Every boundary may satisfy the requirement by editing its local `README.md`.
- A boundary with a local `AGENTS.md` may instead edit that local `AGENTS.md` when the durable operational rules are what changed.
- A boundary that inherits `AGENTS.md` ownership must edit its own local `README.md`; changing a shared ancestor `AGENTS.md` does not mechanically satisfy all inheriting children.
- Changing only the machine-managed review marker does not count as a documentation edit.
- The qualifying documentation edit must be committed at or after the latest owned implementation commit for that review cycle.
- The owned implementation and documentation maintenance surface must be committed before `docs:review` writes the acknowledgement marker.

This ordering prevents an older documentation edit, an uncommitted working-tree edit, or a marker-only commit from being reused as evidence for a later implementation change. The policy is deliberately conservative: the fast test cannot determine whether a code change is semantically documentation-worthy, so the repository requires the owning documentation to be actively maintained for every owned implementation change rather than permitting a marker-only acknowledgement.

## Review one boundary

Use this sequence:

1. make and commit the owned implementation change;
2. inspect the boundary documentation and make a substantive owning `README.md` or local `AGENTS.md` edit;
3. commit that documentation edit at or after the latest owned implementation commit;
4. run:

```sh
npm --workspace neutron-plasmon run docs:review -- <boundary>
```

The command prints the affected owned implementation files, the qualifying committed documentation file, and the relevant implementation/documentation commits before it writes the versioned marker into the boundary README. It refuses to refresh when the implementation/documentation surface is still uncommitted, when no qualifying substantive documentation commit exists, or when the previous review baseline is unavailable.

Commit the resulting marker as a separate review acknowledgement. Refreshing a marker remains an **explicit review acknowledgement**: it records that the operator reviewed committed owned implementation state together with committed owning documentation maintenance. It is not automatic semantic validation and does not prove the prose is correct; durable invariants, architecture changes, runtime constraints, and non-obvious traps must be described accurately rather than satisfied by meaningless churn.

The marker is excluded from documentation-content comparison and from the owned implementation digest. Parent fingerprints also exclude files owned by nested declared boundaries, preserving nearest-boundary ownership.
