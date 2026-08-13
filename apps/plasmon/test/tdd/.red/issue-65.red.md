# Issue #65 — import/paste operation progress state

## Disposition

**RTL RED.** A delayed production filesystem write reaches the current import
path, but FileManager exposes no accessible running operation status. The gate
uses a real FileManager adapter with a deterministic delayed FsService wrapper;
it does not fake timers or filesystem completion.

Run:

```sh
bun test --preload ./apps/plasmon/test/setupHappyDom.ts ./apps/plasmon/test/tdd/.red/issue-65.red.ui.test.tsx
```

## PRESERVE

- FsService owns create/write/copy/move semantics and resource identity.
- Existing collision-aware paste and chunked import behavior remain unchanged.
- Partial success must preserve successful nodes and report failures.
- No byte progress is claimed unless the filesystem contract supplies bytes.

## CHANGE

- Add a small production operation-state vocabulary for import and paste:
  kind, running/completed/failed, item totals/current item, and partial results
  where known.
- Render the state accessibly while work is pending and prevent duplicate
  expensive submissions where appropriate.
- Keep React as a consumer of the operation model, not a second filesystem
  authority.

## UNSPECIFIED

- Exact operation model/module names and status wording.
- Cancellation; no cancellation contract currently exists.
- Byte-level progress.

## Existing guards

`final-gate.test.ts`, `gate3.test.tsx`, `polish.test.tsx`, clipboard tests, and
filesystem tests cover chunking, collision naming, cleanup, and copy/cut
semantics. This gate covers only the missing visible lifecycle boundary.
