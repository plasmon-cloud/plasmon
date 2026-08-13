# Issue #182 — FULL RED PACKET

Classification: **FULL RED PACKET**

## Executable gate

`apps/plasmon/test/tdd/.red/issue-182.red.test.ts`

Focused command:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-182.red.test.ts
```

Current result: production-backed headless bootstrap reaches the root inventory,
which currently contains `Downloads`; the intended `Downloads`-absent assertion
fails. The test also checks that a Favorites projection resolves to actual
canonical root directories rather than presenting nonexistent hard-coded paths.

## Contract

Fresh bootstrap and upgrade/recomposition must:

- stop creating/showing managed Downloads as a default;
- align accepted root resources and Favorites without a second inventory;
- preserve stable NodeIds and user-created resources;
- preserve user rename/move/delete/customization;
- migrate only uncustomized managed defaults, conservatively;
- remain idempotent across repeated bootstrap and reconstructed services.

The authority is managed filesystem bootstrap/reconciliation plus canonical
FsService identity. React Explorer/Favorites is a consumer. No browser gate is
needed for the durable inventory semantics.
