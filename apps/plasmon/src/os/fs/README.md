# Plasmon filesystem

This directory is the implementation boundary behind the frozen `FsService` and `FsEventSource` contracts. Consumers import those contracts; they do not import repository classes.

## Invariants

- `NodeId` is immutable. Rename and move only change name/parent metadata.
- Paths are derived from parent/name and resolve case-insensitively using NFC-normalized name keys.
- Sibling names are unique by normalized case-insensitive key while preserving display spelling.
- The root cannot be renamed, moved, or removed.
- Directories never have readable/writable file content. `file`, `shortcut`, and `atom` nodes share byte semantics.
- Every successful public mutation commits one monotonically increasing filesystem revision. Failed mutations do not change revision.
- File content is SHA-256 addressed and stored in 512 KiB repository chunks. Copies get new node identities while equivalent content reuses blob identity/refcounts.
- Foreground/background byte transport uses at most 384 KiB raw chunks. No large file requires one whole-file JSON message.
- Recursive tree mutations commit metadata/content-reference changes atomically at the repository boundary.
- Files are browser-local by default. Sharing, backup, associations, desktop state, window state, and process state are outside this subsystem.

## Architecture

```text
foreground consumers
       |
       | frozen FsService / FsEventSource
       v
FsRpcClient
       |
       | plasmon.fs.* tools, <=384 KiB raw chunks
       v
app:plasmon:background
       |
       v
FsRpcServer -> PersistentFsService
                    |
                    v
                FsRepository
              /      |       \
   SQLite/OPFS   IndexedDB   memory
  integration     fallback   emergency
```

`PersistentFsService` is the single filesystem authority. It bootstraps `/Desktop`, `/Documents`, `/Downloads`, `/Videos`, `/Pictures`, `/Shared`, and hidden `/System`. The service keeps node/blob metadata in memory and fetches content chunks from its repository for ranged reads.

`IndexedDbFsRepository` is the built-in persistent browser fallback. Metadata and changed content chunks use one IndexedDB transaction so a committed state never points at only partially written content. `MemoryFsRepository` is deterministic for tests and is the last-resort runtime fallback when persistent browser storage cannot initialize.

The preferred production repository remains official SQLite WASM in an OPFS worker using `opfs-sahpool`. The filesystem branch intentionally does not edit shared package/lock files. `createBrowserFsRepository()` therefore accepts a `sqliteRepositoryFactory` hook and tries it before IndexedDB. `DEPENDENCIES.md` records the integration-owned dependency/wiring needed to supply that factory.

## Events and revisions

The authoritative in-process service emits granular frozen `FsEvent` values after a repository commit. The background surface additionally publishes the `fs` app-state topic once per commit. `FsRpcClient` translates those cross-surface invalidations to a frozen `{ type: "reset", revision }` event and consumers can reload cached state. File bytes are never included in invalidation events.

## Write semantics

`write(id, bytes, { offset, truncate })` behaves as an offset patch:

- omitted `offset` means `0`;
- without `truncate`, unaffected existing bytes remain and gaps are zero-filled;
- with `truncate`, final size is exactly `offset + bytes.length`;
- content hash and blob references change only at commit.

The RPC implementation turns a public `write()` into `write_begin`, one or more bounded `write_chunk` calls, then one `write_commit`. Incomplete uploads expire and can be explicitly aborted.

## Integration-affecting edits made by Agent 1

Three minimal files outside `src/os/fs/**` are required so the authority has a persistent Neutron background surface:

- `apps/plasmon/neutron.json` declares `service.html` as the background surface and requests `persistent_browser_storage` there.
- `apps/plasmon/build.ts` builds both `main.js` and filesystem `service.js`.
- `apps/plasmon/public/service.html` loads `service.js`.

No shared package manifest or lockfile was changed.
