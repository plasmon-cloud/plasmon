# #88 consolidated r2 adoption

The historical `tdd/88-red` test at `apps/plasmon/src/os/shell/issue88-red.test.ts` is preserved by the staging wrapper:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-88.characterization.test.ts
```

The wrapper imports the current production-backed guard rather than copying stale pre-#88 imports or duplicating assertions:

`apps/plasmon/src/os/shell/runtimeOnlyInventory.test.ts`

Current permanent result: **4 passing tests, 35 assertions**. It proves:

- js-dos remains registered as a runtime Process/association host;
- runtime-only hosts are absent from launchable native Search and Start inventory;
- legitimate native applications remain present;
- the exact prior managed seed is retired idempotently;
- renamed, moved, metadata-customized, deleted, and user-created entries are preserved correctly;
- association-driven `.jsdos` opening still reaches the runtime host.

Disposition: **COMPLETE / NO IMPLEMENTATION REQUIRED** for the Luna gate. The historical `tdd/88-red` branch has no unique executable coverage left after this adoption and is safe for later deletion; do not delete it from this task.
