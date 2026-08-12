# Plasmon filesystem

`fs/**` implements the filesystem authority behind the public `FsService`/`FsEventSource` contracts. Higher layers consume those services; they do not own repository or storage semantics.

## Architecture

The implementation is deliberately layered:

```text
foreground consumers
      -> FsService / FsEventSource
      -> hosted RPC client or local service
      -> persistent filesystem service
      -> repository/storage adapter
```

Hosted Plasmon keeps durable browser filesystem ownership behind the application's persistent background/RPC boundary. Standalone preview may use a local browser repository. Repository choice is an implementation detail behind the filesystem service.

`core.ts` composes the higher-level filesystem policy layer around the raw service: bootstrap/reconciliation, protected managed resources, Trash operations, external application projections, and the shared filesystem-aware open dispatcher. Durable seeds and demo/fixture seeds are intentionally separate inputs.

## Durable semantics

- A node has stable identity independent of path and display name.
- Rename/move change presentation/location, not identity.
- Public mutations advance filesystem revision only after successful commit.
- Repository commits must not expose partially applied metadata/content state.
- Event streams are invalidation/change signals; consumers re-read authoritative state rather than treating events as a second database.
- Resource classification/protection policy is centralized rather than duplicated in Desktop/FileManager/Shell.
- Generic resource opening and shortcut dereference are shared OS behavior rather than UI-owned dispatch.
- Bootstrap/reconciliation must be versionable and idempotent so upgrades can repair expected managed state without destroying user state.

## Program Files boundary

`/System/Program Files` is the canonical filesystem location for curated packaged runtime/application resources. Filesystem owns the durable directory identity, managed/protected semantics, and versioned root reconciliation; it does **not** own runtime asset semantics or application installation state.

Runtime owners use `FilesystemCoreServices.programFiles` rather than recreating `/System/Program Files` policy themselves. The narrow filesystem seam is:

```ts
await filesystem.programFiles.root();
await filesystem.programFiles.ensureRuntimeDirectory("MonacoEditor");
```

`ensureRuntimeDirectory()` creates or repairs one direct managed child while preserving an existing directory's `NodeId`, metadata, and contents. The runtime/native-app Area remains responsible for what that subtree means and whether packaged HTTP assets are projected into it.

Program Files is **not** a Neutron Element installation database. `/Apps/*.neutron` remains the filesystem projection of Kernel-authoritative installation state. A Program Files subtree does not imply a `.sys` application, and runtime resources such as js-dos or EmulatorJS must not acquire fake `DOS.sys`, `Emulator.sys`, or similar wrappers merely because they have Program Files resources.

## Refactor direction

Keep storage mechanics, managed-resource policy, projection reconciliation, Trash, and open dispatch as separable responsibilities even when composed by one filesystem core. Avoid growing `FsService` into a catch-all for unrelated desktop/application state.

When `managed.ts` or other policy modules become difficult to reason about, split them by durable responsibility rather than by historical feature wave. Preserve one public filesystem authority and one repository transaction boundary.

## Testing

Use fast tests for identity, naming, revisions, atomic mutations, copy/move/remove semantics, bootstrap/reconciliation, protection/classification, projections, Trash, and shared open dispatch. Repository/RPC tests should prove persistence and transport boundaries without duplicating service logic.

Use browser/package tests only for behavior that genuinely crosses browser persistence/background surfaces or packaged user-visible opening. A UI regression caused by filesystem policy should normally receive a production service/model regression first.
