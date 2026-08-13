# Issue #182 — repaired packet

Disposition: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**.

## Executable evidence

- `issue-182.red.test.ts` uses the real headless Plasmon composition and FsService
  to prove fresh bootstrap currently still creates `Downloads`, then exercises
  idempotence, user-root rename/delete, and recomposition.
- `issue-182.red.ui.test.tsx` renders the real `ExplorerApp` through
  `renderPlasmon`, opens it through the production Start/FileManager path, and
  compares the actual Favorites buttons against the actual root inventory. It
  does not reproduce a test-local Favorites path list.

Focused commands:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-182.red.test.ts
bun test --preload ./apps/plasmon/test/setupHappyDom.ts ./apps/plasmon/test/tdd/.red/issue-182.red.ui.test.tsx
```

## Covered contract

- fresh bootstrap excludes managed Downloads;
- repeated bootstrap/recomposition is idempotent;
- actual production Favorites projection reflects canonical root resources;
- user-created root directories survive recomposition;
- intentional rename and deletion are not resurrected;
- canonical NodeId identity remains filesystem-owned.

## Remaining acceptance

The current production branch has no explicit durable Favorites customization
model separate from Explorer's projection. If the accepted implementation adds
user-editable Favorites, add one production-backed migration gate for rename,
move, delete and user ordering/customization preservation. Until that seam is
observable, this packet does not claim that criterion complete. Managed legacy
Downloads migration must distinguish owned defaults from user-created data and
must not delete a user-owned folder.
