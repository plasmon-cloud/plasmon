# Documentation review fingerprints

Plasmon documentation boundaries use machine-managed review fingerprints to make implementation drift visible without forcing meaningless prose edits.

The boundary inventory in `documentation-boundaries.json` assigns implementation files to their nearest declared documentation boundary. A nested boundary owns its own subtree, so a change under a child boundary does not mechanically stale every ancestor README.

## Inspect status

From the repository root:

```sh
npm --workspace neutron-plasmon run docs:review:status
```

A stale boundary reports representative owned files and the command used to review that boundary.

## Review one boundary

After reading the boundary's current README, applicable AGENTS rules, and the reported implementation change surface, run:

```sh
npm --workspace neutron-plasmon run docs:review -- <boundary>
```

The command prints the affected owned files before it writes the versioned marker into the boundary README. If the implementation change established a new durable invariant, update the appropriate README/AGENTS/canonical documentation first. If the existing documentation is still accurate, a marker-only update is valid.

Refreshing a marker is an **explicit review acknowledgement**. It records that the operator reviewed the owned implementation state against the boundary documentation. It is not automatic semantic validation, does not prove the prose is correct, and must not be used to hide a known documentation mismatch.

The marker is excluded from its own digest. Parent fingerprints also exclude files owned by nested declared boundaries, preserving nearest-boundary ownership.
