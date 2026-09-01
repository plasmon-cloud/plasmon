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

## Resource classification

`resourcePolicy.ts` is the canonical derived-classification seam. Stronger persisted `FsNode` resource and MIME metadata is authoritative. When stronger metadata is absent, the classifier may derive MIME, content family, and language hints from the current filename; otherwise it falls back safely to unknown.

The normal precedence is: **stronger explicit resource/MIME metadata > filename-derived inference > unknown fallback**. Specific explicit MIME is never replaced by a filename guess. Rename preserves `NodeId`; a derived classification may change with the filename when no stronger metadata pins it.

One enduring compatibility rule keeps generic `text/plain` from becoming false source-language authority: when the current filename is a source extension recognized by the canonical table, `text/plain` may be refined to that filename-derived source MIME/language. This covers both generic text transport metadata and older Plasmon-authored resources that persisted `text/plain` before a later rename. The rule is intentionally narrow: Markdown/plain precedence is unchanged, media is not inferred through a conflicting explicit MIME, and specific values such as `application/octet-stream` or an explicit source MIME remain authoritative. Consumers must use this centralized result rather than adding their own exception.

System and installed-application identity remains metadata-backed. A `.sys` or `.neutron` suffix by itself does not create application authority.

Classification does not choose handlers or presentation. `AssociationRegistry` and `OpenService` remain responsible for matching/default-open policy. Visual and application surfaces consume classification and may apply their own bounded capability rules, but they must not keep a competing global extension-to-MIME/type table.

## Program Files boundary

`/System/Program Files` is the canonical filesystem location for curated packaged runtime/application resources. Filesystem owns the durable directory identity, managed/protected semantics, and versioned root reconciliation; it does **not** own runtime asset semantics or application installation state.

Runtime owners use `FilesystemCoreServices.programFiles` rather than recreating `/System/Program Files` policy themselves. The narrow filesystem seam is:

```ts
await filesystem.programFiles.root();
await filesystem.programFiles.ensureRuntimeDirectory("MonacoEditor");
```

`ensureRuntimeDirectory()` creates or repairs one direct managed child while preserving an existing directory's `NodeId`, metadata, and contents. The runtime/native-app Area remains responsible for what that subtree means and whether packaged HTTP assets are projected into it.

Program Files is **not** a Neutron Element installation database. `/Apps/*.neutron` remains the filesystem projection of Kernel-authoritative installation state. A Program Files subtree does not imply a `.sys` application, and runtime resources such as js-dos or EmulatorJS must not acquire fake `DOS.sys`, `Emulator.sys`, or similar wrappers merely because they have Program Files resources.

## Subsystem-owned configuration documents

Non-runtime advanced OS configuration lives in subsystem-owned documents below the managed `/System/Configuration` root. This is a filesystem location and reconciliation convention, not a monolithic settings file, Registry clone, or universal key/value service. Each owner declares its own file name, schema identity/version, defaults, validation/effective-value derivation, migrations, and truthful reload class.

`ManagedConfigurationService` creates an owner directory and declared file once, marks the containers as system-managed, and preserves existing file bytes and unknown metadata on later boot/reconcile. `ProtectedManagedFsService` blocks arbitrary child creation, rename/move/copy/removal, and metadata tampering in those containers, while permitting ordinary writes to a valid declared configuration file. This exception applies only to file contents; it does not make configuration containers, packaged runtime source, or arbitrary children writable.

`FilesystemConfigurationDocumentStore` is the reusable owner-file contract: malformed or unsupported documents use the last-known-good effective value while running and canonical defaults on cold start, invalid known fields use owner-defined safe defaults, migrations are explicit and preserve the document unless the owner changes it, and restore-defaults is an explicit filesystem write. It subscribes once to the filesystem invalidation seam and re-reads authoritative bytes; it does not poll or maintain per-property watchers. Runtime/application configuration remains under its owner-specific `/System/Program Files` seam, including Monaco's runtime configuration, and ordinary Shell, Visual, association, hidden-visibility, and diagnostic preferences remain in their existing authorities.

## Refactor direction

Keep storage mechanics, managed-resource policy, projection reconciliation, Trash, and open dispatch as separable responsibilities even when composed by one filesystem core. Avoid growing `FsService` into a catch-all for unrelated desktop/application state.

When `managed.ts` or other policy modules become difficult to reason about, split them by durable responsibility rather than by historical feature wave. Preserve one public filesystem authority and one repository transaction boundary.

## Testing

Use fast tests for identity, naming, revisions, atomic mutations, copy/move/remove semantics, bootstrap/reconciliation, protection/classification, projections, Trash, and shared open dispatch. Repository/RPC tests should prove persistence and transport boundaries without duplicating service logic.

Use browser/package tests only for behavior that genuinely crosses browser persistence/background surfaces or packaged user-visible opening. A UI regression caused by filesystem policy should normally receive a production service/model regression first.
