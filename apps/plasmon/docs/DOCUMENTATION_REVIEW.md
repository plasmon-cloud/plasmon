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

An owned implementation change must be accompanied by a real content edit to that boundary's owning documentation before its review fingerprint can be refreshed.

- Every boundary may satisfy the requirement by editing its local `README.md`.
- A boundary with a local `AGENTS.md` may instead edit that local `AGENTS.md` when the durable operational rules are what changed.
- A boundary that inherits `AGENTS.md` ownership must edit its own local `README.md`; changing a shared ancestor `AGENTS.md` does not mechanically satisfy all inheriting children.
- Changing only the machine-managed review marker does not count as a documentation edit.

This policy is deliberately conservative. The fast test cannot determine whether a code change is semantically documentation-worthy, so the repository requires the owning documentation to be actively maintained for every owned implementation change rather than permitting a marker-only acknowledgement.

## Review one boundary

After reading the boundary's current README, applicable AGENTS rules, the reported implementation change surface, and making the required owning documentation edit, run:

```sh
npm --workspace neutron-plasmon run docs:review -- <boundary>
```

The command prints the affected owned implementation files and the documentation files changed since the previous review base before it writes the versioned marker into the boundary README. If no qualifying documentation content changed, the command refuses to refresh the marker and explains which README/local-AGENTS file must be edited.

Refreshing a marker remains an **explicit review acknowledgement**. It records that the operator reviewed the owned implementation state together with an owning documentation edit. It is not automatic semantic validation and does not prove the prose is correct; durable invariants, architecture changes, runtime constraints, and non-obvious traps must be described accurately rather than satisfied by meaningless churn.

The marker is excluded from documentation-content comparison and from the owned implementation digest. Parent fingerprints also exclude files owned by nested declared boundaries, preserving nearest-boundary ownership.
