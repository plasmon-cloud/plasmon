# Plasmon filesystem / desktop resource architecture

Status: current normative cross-subsystem architecture  
Scope: filesystem-visible resources, Desktop, Start/Search opening, shortcuts, installed-application projections, Trash, hidden resources, and Program Files

This document states the durable cross-subsystem rules. Implementation details belong to the owning subsystem README/AGENTS files and contracts.

## Core model

Plasmon has one filesystem authority and one application-opening architecture.

- `FsService` / filesystem core owns durable filesystem identity and mutations.
- `NodeId` is stable filesystem identity; path and display name are mutable presentation.
- Resource classification/protection policy is centralized in filesystem policy rather than duplicated by Desktop, FileManager, Start, Search, or applications.
- Generic resource opening and shortcut dereference go through the shared filesystem-aware open path, then delegate to the owning native-app, association/runtime, or Neutron authority.
- React surfaces render and translate user interaction; they do not create parallel storage, opening, Trash, or application registries.

The current implementation boundary is documented in [`../src/os/fs/README.md`](../src/os/fs/README.md).

## Filesystem-visible resource identity

`FsNode.kind` remains the generic filesystem model. Application identity is metadata-backed; filename suffixes alone never create authority.

- A Plasmon-native system application may be represented as a normal filesystem file with validated system-application metadata and a `.sys` presentation name.
- A Kernel-installed Neutron application may be represented as a normal filesystem file with validated installed-application projection metadata and a `.neutron` presentation name.
- A user-created `notes.sys` or `archive.neutron` file does not become a protected or launchable application merely because of its suffix.
- Shortcuts are independent filesystem nodes whose targets have separate stable identity.

Consumers should use the canonical resource classifier and capability policy rather than inferring semantic identity from extensions or local UI state.

## Ownership and reconciliation classes

Filesystem-visible resources fall into distinct lifecycle classes:

- **system-required** — Plasmon-managed anchors/resources required by the OS. Reconciliation may repair them and should preserve existing stable identity where possible.
- **seeded-default** — introduced as initial content and then owned by user intent. Once introduced, user rename/move/delete must not be silently undone on upgrade.
- **installed-application projection** — derived from Kernel-authoritative installed Element state. The projection is not installation authority.
- **user-owned** — ordinary user resources, directories, shortcuts, and local logical resources.
- **temporary/demo fixture** — explicitly non-authoritative content used for demos/tests; it must remain separable from durable defaults and must not gain privileged execution semantics.

Bootstrap and reconciliation must be idempotent and versionable. Managed repair must not become a reason to overwrite unrelated user state.

## Canonical roots and projections

The durable architecture uses these roles:

- `/Desktop` — a real filesystem directory presented by Desktop.
- `/System/Start Menu` — filesystem-backed Start inventory; Start is a projection/view, not a second application database.
- `/Apps` — filesystem projection of Kernel-installed Neutron applications.
- `/System/Program Files` — curated managed inspection/configuration/resources for Plasmon-owned runtimes and applications; not a mirror of `node_modules`, build output, or Kernel installation state.
- `/System/.Trash` — internal recoverable-delete storage behind the canonical Trash service.

Additional current roots and compatibility-owned paths remain governed by filesystem bootstrap/migration code. This document does not authorize destructive removal of existing persisted directories merely because they are not listed above.

## Opening and execution

All user-facing resource surfaces converge on the same opening authority.

Conceptually:

```text
filesystem resource
  -> canonical resource classification / shortcut resolution
  -> shared open dispatcher
     -> Plasmon-native application handler
     -> AssociationRegistry / runtime handler
     -> Neutron bridge for installed Element projection
```

Desktop, FileManager, Start, Search, and shortcuts must not maintain separate launch switches for the same resource classes.

### Native system resources

A validated native-system resource resolves to its registered Plasmon-native handler. Process/Windowing remains responsible for application lifecycle and window behavior. The filesystem representation does not instantiate UI directly.

### Installed Neutron application projections

`/Apps/*.neutron` is derived from Kernel-authoritative installed application state.

- reconciliation keys application identity to the authoritative Element/app identity rather than filename;
- refresh updates projection metadata without creating a second install database;
- opening delegates to the Neutron bridge / Kernel execution path;
- temporary bridge failure must not be interpreted as authoritative uninstall;
- generic filesystem Delete must not pretend to uninstall a Kernel application.

Any install/uninstall operation remains Neutron-owned. Plasmon may expose the user-facing action only through an actual supported Neutron capability.

### Association-backed runtime resources

Content such as game/runtime files remains ordinary filesystem content. Association resolution chooses the owning runtime. A runtime package under Program Files does not imply a fake `.sys` application wrapper, and generic opening must never special-case individual game/content names.

Current game/runtime authority lives in [`../src/games/README.md`](../src/games/README.md) and [`../src/native-apps/README.md`](../src/native-apps/README.md).

## Shortcuts

Shortcuts preserve the identity distinction between the shortcut node and its target.

- Filesystem-node targets use stable target identity rather than mutable path strings.
- Installed-application shortcuts use the stable application/Element identity when that is the authoritative target.
- Shortcut opening dereferences through the same canonical open path as direct opening.
- Broken, removed, or otherwise unavailable targets must fail truthfully rather than falling back to a coincidental path/name match.
- Shortcut presentation may compose target artwork with an overlay, but presentation does not own execution semantics.

## Delete, Trash, and protection

Ordinary recoverable Delete delegates to the canonical filesystem Trash service.

- moving a resource to Trash preserves its stable filesystem identity;
- restore/permanent-delete/empty operations remain Trash/filesystem authority concerns;
- protected system resources and installed-application projections are not normal Trash candidates;
- UI surfaces own confirmation and presentation, not an alternate delete store or protection policy.

See [`../src/os/fs/README.md`](../src/os/fs/README.md) and the Recycle Bin/FileManager documentation for current implementation details.

## Hidden resources

Hidden-resource semantics are filesystem-owned. Presentation preferences such as “show hidden files” select whether hidden entries are requested/rendered; they do not weaken protection or create a second hidden flag owned by FileManager/Shell.

System-internal areas such as Trash may remain semantically excluded from ordinary search/listing even when hidden resources are visible.

## Program Files

`/System/Program Files` is a curated managed surface for stable Plasmon-owned application/runtime resources.

Filesystem owns the directory identity, managed/protected lifecycle, and narrow materialization seam. Runtime/application owners define the meaning and contents of their subtrees.

Program Files is not:

- a Neutron Element installation database;
- a requirement that every runtime becomes a user-launchable `.sys` application;
- a license to expose transient build output or dependency trees as durable filesystem state.

The current Program Files contract is documented in [`../src/os/fs/README.md`](../src/os/fs/README.md).

## Current authority by subsystem

- Filesystem identity, reconciliation, classification, projections, Trash, Program Files, shared open dispatch: [`../src/os/fs/README.md`](../src/os/fs/README.md)
- Associations/default handlers: [`../src/os/associations/README.md`](../src/os/associations/README.md)
- Desktop presentation/placement: [`../src/os/desktop/README.md`](../src/os/desktop/README.md)
- FileManager commands/presentation: [`../src/os/file-manager/README.md`](../src/os/file-manager/README.md)
- Start/Search/taskbar shell projections: [`../src/os/shell/README.md`](../src/os/shell/README.md)
- Native applications/runtime hosts: [`../src/native-apps/README.md`](../src/native-apps/README.md)
- Visual presentation: [`../src/os/visual/README.md`](../src/os/visual/README.md)
- Neutron adapter boundary: [`../src/os/neutron/README.md`](../src/os/neutron/README.md)

When a scoped current README/contract is more specific than this cross-subsystem overview, follow the scoped current authority and update this document if the cross-cutting rule changed.
