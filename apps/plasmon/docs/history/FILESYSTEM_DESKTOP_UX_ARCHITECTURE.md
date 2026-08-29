# Plasmon Filesystem / Desktop UX Architecture

Status: design for implementation review  
Scope: Plasmon filesystem-visible application model, Desktop, Start, Search, Properties, shortcuts, hidden resources, Program Files, and Recycle Bin  
Starting repository state: `3dc25e00511c9070165560e324aba3cc31235a8e`

## Decision summary

Plasmon should keep one filesystem and one application execution architecture.

The existing `FsService`, stable `NodeId`, `FsNode.metadata`, `OpenService`, `NativeAppRegistry`, association registry, process/window runtime, and Neutron bridge are already sufficient for almost all of the desired model. The design does **not** add another filesystem, does **not** add direct persistent storage, does **not** create `.sys` or `.neutron` `FsNodeKind` variants, and does **not** create another Neutron runtime or iframe path.

The central decisions are:

1. `.sys` and `.neutron` are filesystem-visible `kind: "file"` resources with validated Plasmon metadata/MIME conventions. Their extensions are presentation conventions, not sufficient authority by themselves.
2. `/Desktop` remains a real filesystem directory. Default desktop shortcuts are seeded once; after that, user rename/move/delete intent wins.
3. Start is solely a filesystem view over `/System/Start Menu`. It must stop being a parallel registry of native and Neutron applications.
4. The existing `plasmon.shortcut` v1 target shape is sufficient. Opening any shortcut must go through one shared filesystem-aware open dispatcher used by Desktop, FileManager, Start, and Search.
5. Hidden state is derived from a leading `.` in the name. `Show hidden files` controls listing and Search visibility. It is not a second persistent hidden flag.
6. `/Apps/*.neutron` is a projection of Kernel-installed Neutron apps. Kernel/Neutron state is authoritative. The filesystem projection does not own app execution or package installation state.
7. Normal Delete becomes a soft delete into an internal `/System/.Trash` store. Move-based trash preserves the original `NodeId`.
8. `/System/Program Files` is a curated, system-owned inspection surface for stable runtime packages/assets, not a mirror of `node_modules` or transient build output.
9. Required system resources, one-time seeded defaults, installed-app projections, and user-owned resources have different reconciliation rules.
10. One minimal frozen-contract amendment is required for the requested Neutron Uninstall UX: the current `NeutronBridge` has no uninstall-flow entry point.

---

# 1. Executive summary

Plasmon is now large enough that Desktop, Start, filesystem resources, Plasmon-native apps, Neutron-installed apps, Atoms, shortcuts, Search, Properties, and Delete behavior need to agree on the same identity and lifecycle model.

The filesystem should be the visible organizing model, while existing runtime services remain the execution model.

That distinction is important:

- A `.sys` file represents a Plasmon-native application/dialog in the filesystem, but `OpenService`/the native process runtime still launches it.
- A `.neutron` file represents a Kernel-installed Neutron application in `/Apps`, but `NeutronBridge` still delegates launch/reuse to Kernel.
- A shortcut is an independent filesystem node, but it dereferences a stable target and then uses the same open path as opening that target directly.
- Recycle Bin stores deleted filesystem identity, but does not become an alternate storage engine.
- Program Files exposes stable resources/package information without making persistent user storage mirror Plasmon's package manager/build graph.

This architecture deliberately treats path as navigation/presentation and `NodeId` as filesystem identity. Renaming or moving a resource changes its path, not its identity. Shortcuts to filesystem nodes store `NodeId`, not path strings.

There are four ownership/lifecycle classes:

- **system-required** — Plasmon must reconcile these resources. Examples: `/System`, `/Apps`, `/Desktop`, `/System/FileManager.sys`, `/System/RecycleBin.sys`, `/System/Start Menu`, `/System/Program Files`, `/System/.Trash`.
- **seeded-default** — Plasmon creates these once, then never overwrites user intent. Examples: Desktop shortcuts, example documents/media, initial Start shortcuts, default Games content.
- **installed-app projection** — `/Apps/*.neutron` mirrors authoritative Kernel installation state.
- **user-owned** — normal files, directories, shortcuts, and local Atom resources.

The policy layer should classify a node into its semantic resource category before offering commands. This prevents each UI surface from independently inventing rules for Delete, Rename, Copy, Uninstall, Properties, and shortcuts.

No major long-term design choice remains blocked on external UX research. Windows/macOS and daedalOS all reinforce the useful distinction between a shortcut and its target, filesystem-backed desktop/start surfaces, and recoverable deletion. daedalOS also demonstrates that exposing stable application/runtime assets can be useful, but Plasmon should expose a curated package surface rather than copy an unstable build tree into persistent storage.

---

# 2. Proposed root filesystem

Recommended fresh-profile presentation:

```text
/
├── Desktop/
│   ├── Root                 -> shortcut to /
│   ├── Apps                 -> shortcut to /Apps
│   ├── Doom                 -> shortcut to /Games/DOS Bundles/doom.jsdos
│   ├── Recycle Bin          -> shortcut to /System/RecycleBin.sys
│   └── ...user files / Atoms / shortcuts
│
├── Documents/
│   ├── ...3 seeded example .whtml files
│   ├── ...2 seeded example .md files
│   └── ...1 seeded example .txt file
│
├── Games/
│   ├── DOS Bundles/
│   │   ├── doom.jsdos
│   │   ├── dn3d.jsdos
│   │   └── w3d.jsdos
│   ├── Roms/
│   │   ├── Alter Ego.nes
│   │   ├── Anguna.gba
│   │   ├── Mega Qbert.gen
│   │   ├── School Rush.nds
│   │   ├── Halo 2600.a26
│   │   └── Classic Kong.smc
│   └── Saves/
│
├── Music/
│   ├── example.mp3
│   ├── example.wav
│   └── example.opus
│
├── Pictures/
│   ├── example.jpg
│   ├── transparent-example.png
│   ├── example.webp
│   ├── example.svg
│   └── example.gif
│
├── Videos/
│   └── ...seeded example video
│
├── Apps/
│   ├── Mail.neutron
│   └── ...one projection per installed Neutron app
│
└── System/
    ├── FileManager.sys
    ├── Settings.sys
    ├── Start.sys
    ├── Search.sys
    ├── Photos.sys
    ├── Browser.sys
    ├── RecycleBin.sys
    ├── .Properties.sys
    ├── .Trash/
    ├── Start Menu/
    │   └── ...folders and shortcuts consumed by Start
    └── Program Files/
        ├── MonacoEditor/
        ├── Webamp/
        ├── TinyMCE/
        ├── js-dos/
        └── EmulatorJs/
```

`Video.js` is intentionally not a required package in this architecture. It should appear only if the native Video implementation actually adopts it.

## Required roots versus seeded roots

The following are **system-required anchors** because product surfaces depend on their identity/location:

- `/Desktop`
- `/Apps`
- `/System`
- `/System/Start Menu`
- `/System/Program Files`
- `/System/.Trash`
- required `.sys` resources

The following should be **seeded defaults**, not immortal system resources:

- `/Documents`
- `/Games`
- `/Music`
- `/Pictures`
- `/Videos`
- sample content beneath them

If a user intentionally deletes or reorganizes a seeded-default directory after it was introduced, an upgrade must not silently recreate it.

## Existing `/Downloads` and `/Shared`

Current `PersistentFsService` creates `Desktop`, `Documents`, `Downloads`, `Videos`, `Pictures`, `Shared`, and `System` for a fresh store. This design must not destructively remove existing `/Downloads` or `/Shared` during migration.

`/Shared` is especially outside Agent 10 ownership because sharing/MTN semantics may depend on it. Keep it where it is until the sharing owner explicitly approves a path/lifecycle change. Migrated profiles may therefore contain compatibility/feature-owned root directories not shown in the clean product tree above.

---

# 3. Resource taxonomy

`FsNode.kind` remains:

```ts
"directory" | "file" | "shortcut" | "atom"
```

Do not add `"sys"` or `"neutron"` kinds.

Instead, classify nodes semantically through existing fields and validated metadata.

| Semantic resource | `FsNode.kind` | Authoritative identity | Ownership |
|---|---|---|---|
| Ordinary file | `file` | `NodeId` | user or seeded-default |
| Directory | `directory` | `NodeId` | user, seeded-default, or system-required anchor |
| Shortcut | `shortcut` | shortcut `NodeId`; target has separate identity | user, seeded-default, or managed Start entry |
| Plasmon system app | `file` | stable system-app key + node `NodeId` | system-required |
| Neutron app projection | `file` | Kernel Element/app ID; node `NodeId` is projection identity | installed-app projection |
| Atom | `atom` or existing Atom descriptor convention | Atom descriptor identity + node `NodeId` | user/local representation |
| Program package/resource | file/directory | package key + node `NodeId` | system-required |
| Trash wrapper | directory | wrapper `NodeId`; references trashed node `NodeId` | internal system-required machinery |

## Why extension alone is not authority

A user must be allowed to create a normal file named `notes.sys` or `old.neutron` without accidentally gaining system protection or becoming a launchable installed app.

Therefore:

- a `.sys` filename is recognized as a Plasmon system application only when its structured system-app metadata is valid;
- a `.neutron` filename is recognized as an installed-app projection only when its structured projection metadata is valid and the projection is managed by reconciliation;
- spoofed/incomplete metadata must not grant protected semantics;
- resource classification should be centralized, not repeated in FileManager, Search, Start, and Properties.

Recommended internal helpers (names are illustrative and not frozen contracts):

```ts
classifyFsResource(node): ResourceSemantics
capabilitiesForResource(node): ResourceCapabilities
```

This policy layer is where protected operations belong. `FsService` should remain a storage-neutral primitive rather than learn application-specific rules.

---

# 4. `.sys` semantics

## Meaning

A `.sys` resource is the filesystem identity of a Plasmon-native application or system dialog. It is not a Neutron app and is not an executable byte blob.

Recommended representation:

```ts
{
  kind: "file",
  name: "FileManager.sys",
  mime: "application/x-plasmon-system-app",
  metadata: {
    "plasmon.systemApp": {
      format: "plasmon.system-app",
      version: 1,
      systemId: "file-manager",
      handlerId: "native:explorer"
    },
    "plasmon.ownership": "system-required"
  }
}
```

The exact metadata key names are implementation details, but the format should be versioned and validated.

`systemId` is the reconciliation identity. `handlerId` is the execution binding.

## Opening

Opening a valid `.sys` resource resolves its native handler and delegates to the existing `OpenService`. `OpenService`/process/window policy remains responsible for singleton reuse and focus behavior.

Examples:

```text
open /System/FileManager.sys
    -> OpenService.open("native:explorer", { nodeId: ... })

open /System/Settings.sys
    -> OpenService.open("native:settings", { nodeId: ... })
```

The filesystem resource does not instantiate React directly and does not create another process system.

`.Properties.sys` is an intentional special case. Its leading `.` makes it hidden by default. Opening it without a target should not produce an error; the Properties app should show a small empty state such as “Choose Properties on a file, folder, application, or Atom to inspect it.” When invoked with a target, it opens the target-specific Properties view.

## Operations

System `.sys` resources are protected:

- Rename: disabled.
- Move: disabled.
- Copy: disabled. Copying the representation would not create another system app.
- Delete: disabled.
- Download: disabled.
- Open With: disabled.
- Create shortcut: allowed.
- Pin: allowed.
- Properties: allowed.
- Search: allowed if visible under current hidden setting.

The `/System` directory can contain resources with different policy. Protecting `.sys` does **not** imply that everything under `/System/Start Menu` is immutable.

## Icons

The base icon should come from the registered `NativeAppDefinition.icon` or the stable system icon mapping associated with `systemId`, not from the `.sys` extension.

Agent 11 owns artwork. Agent 10 requires the visual system to support:

- distinct system-app resource category;
- target-derived shortcut base icon;
- shortcut overlay;
- optional protected/system visual state without making the Desktop visually noisy.

## Upgrades and NodeId

Reconciliation locates the system resource by stable `systemId`. If it exists, update managed metadata/icon/version information in place and preserve its `NodeId`.

If a required `.sys` resource is unexpectedly missing, recreate it. That recovery may necessarily allocate a new `NodeId` because `FsService.createFile()` does not accept a caller-supplied ID. UI policy should make deletion impossible, so recreation is a corruption/legacy recovery path rather than normal lifecycle.

Seeded shortcuts maintained by Plasmon can be repaired to a recreated system resource. User-created node-target shortcuts to a genuinely destroyed resource may remain broken; that is preferable to adding path-based identity or a special fixed-ID creation API merely for this rare recovery path.

---

# 5. `.neutron` semantics

## Meaning

`/Apps/*.neutron` is a filesystem projection of authoritative Kernel-installed Neutron applications.

It is **not**:

- an application data file;
- a package archive;
- an iframe;
- a second running instance;
- a second install database.

Recommended representation:

```ts
{
  kind: "file",
  name: "Mail.neutron",
  mime: "application/x-plasmon-neutron-app",
  metadata: {
    "plasmon.neutronApp": {
      format: "plasmon-neutron-app",
      version: 1,
      elementId: "mail"
    },
    "plasmon.ownership": "installed-app-projection"
  }
}
```

Projection metadata may cache display metadata such as known version/description/icon provenance for rendering, but `elementId` is the canonical app identity and Kernel remains authoritative.

## Reconciliation with Kernel

`NeutronBridge.loadElements()` is the authoritative discovery input.

On a successful reconciliation:

1. for each installed Element/app ID, find the existing projection by `elementId`;
2. update display name, version, icon metadata, or other safe presentation data in place;
3. create a projection if none exists;
4. remove a projection only when a successful authoritative list proves the app is no longer installed;
5. do **not** remove projections merely because a bridge request failed or runtime state is temporarily unknown.

This preserves `NodeId` during upgrades/refreshes while an application remains installed.

Projection names are sanitized from the Element display name plus `.neutron`. Collision handling uses familiar suffixes:

```text
Mail.neutron
Mail (1).neutron
Mail (2).neutron
```

Because user rename/move is disabled for projections, reconciliation may safely update a projection's managed display name when the authoritative app display name changes. The assignment must remain deterministic among collisions.

## Opening

Opening a `.neutron` projection calls:

```ts
NeutronBridge.openElement(elementId, ...)
```

and nothing else.

The current vanilla bridge already delegates launch to Kernel `openAppTile` with reuse enabled. The projection must never embed or instantiate the app itself.

## Delete versus Uninstall

Normal Delete is disabled.

Expected UX:

```text
User presses Delete on Mail.neutron
    -> filesystem is unchanged
    -> UI says this is an installed application
    -> offers Uninstall…

User chooses Uninstall…
    -> invoke Neutron-owned uninstall flow
    -> keep projection while uninstall is pending
    -> after Kernel state confirms absence, reconciliation removes projection
```

Do not optimistically `fs.remove()` the projection and do not treat uninstall as Recycle Bin deletion.

## Shortcut semantics

For Neutron applications, new shortcuts should normally store the stable Element/app identity using the existing shortcut target:

```ts
{ kind: "element", elementId: "mail" }
```

Properties can resolve that identity to the current projection and display:

```text
Target: /Apps/Mail.neutron
```

This is preferable to storing the current projection `NodeId` because uninstall/reinstall can legitimately create a new projection node. An Element-target shortcut can become temporarily unavailable and heal when the same app identity is reinstalled.

## Search and Start

The `/Apps` projections are the filesystem source of truth for Search's visible installed-app resources. Search should not also render an independent `ExternalElement` result for the same app.

Start can contain a managed shortcut for each installed app. That shortcut points to the app identity/projection, but Start remains a filesystem view; it does not list `loadElements()` results directly as a parallel menu.

---

# 6. Shortcut model

The existing `plasmon.shortcut` v1 format is sufficient:

```ts
type SharedShortcutTarget =
  | { kind: "native"; handlerId: HandlerId }
  | { kind: "element"; elementId: string; tileId?: string; view?: string }
  | { kind: "node"; nodeId: NodeId }
  | { kind: "url"; url: string };
```

Do not introduce path-string shortcut identity.

## Target selection

Use targets as follows:

- normal file -> `node` target;
- directory -> `node` target;
- `.sys` -> `node` target is valid when the filesystem identity matters; stable `native` target is also valid for shell-managed native pins/entries;
- `.neutron` -> prefer `element` target so reinstall can heal the shortcut;
- Atom -> `node` target unless an existing Atom-specific launch target is required by current contracts;
- game file -> `node` target;
- URL -> `url` target.

## Canonical launch flow

Create one filesystem-aware open dispatcher used by every surface. A useful internal shape is:

```ts
interface FilesystemOpenDispatcher {
  openNode(nodeId: NodeId): Promise<void>;
  openShortcut(nodeId: NodeId): Promise<void>;
}
```

Exact naming is not important. Ownership is.

`openNode()` behavior:

1. `stat()` the node.
2. If it is a directory, open FileManager/Explorer at that `NodeId`.
3. If it is a shortcut, parse `plasmon.shortcut` and dereference it.
4. If it is a valid `.sys`, route to its native handler through `OpenService`.
5. If it is a valid `.neutron`, route to `NeutronBridge.openElement()`.
6. If it is an Atom/ordinary file, resolve associations and route through `OpenService`.
7. If a URL shortcut is being dereferenced, route to the registered browser handler through `OpenService`.

Shortcut recursion must have a visited set and a small depth guard. A malformed cycle produces a friendly “This shortcut points to another shortcut in a loop” message, not an internal exception string.

The current FileManager behavior that intentionally throws:

```text
Shortcut launch dispatch is owned by Shell
```

must disappear. That is an architecture boundary leaking into user UX.

## Shortcut file behavior

A shortcut has its own `NodeId`, name, parent, timestamps, and Desktop position.

- Renaming/moving a shortcut changes only the shortcut.
- Copy copies the shortcut resource, not its target.
- Delete moves only the shortcut to Recycle Bin.
- Properties identifies both shortcut identity and target identity.
- Opening executes/opens the target.
- Base icon is the target's icon.
- A small overlay indicates “shortcut.”
- Broken target receives a broken/unavailable visual state.

When “Create shortcut” is invoked on an existing shortcut, flatten to its final stable target where safely resolvable instead of creating unnecessary chains. The open dispatcher must still handle chained shortcuts because imported/legacy resources may contain them.

## Naming

For `Create shortcut` in the same folder, use a familiar name and collision sequence, for example:

```text
Report
Report - Shortcut
Report - Shortcut (1)
Report - Shortcut (2)
```

For `Send to > Desktop`, preserve the target's display name first:

```text
Report
Report (1)
Report (2)
```

Collision logic belongs in a shared helper rather than separate Desktop/Start implementations.

## Trashed/broken targets

A shortcut to a node currently inside Recycle Bin should not silently open through the hidden trash storage. Show a recoverable state such as:

```text
This shortcut's target is in Recycle Bin. Restore it to open it.
```

Because soft-delete preserves the target `NodeId`, restoring the target automatically heals the shortcut.

---

# 7. Hidden-file model

## Canonical rule

A resource is hidden when its name begins with `.`.

Examples:

```text
.Properties.sys
.secret
.Trash
```

Do not maintain a second long-term `hidden: true` truth source for ordinary nodes.

The current filesystem implementation filters `list()` using `metadata.hidden`. That is an implementation behavior to migrate, not a reason to preserve two competing conventions.

The existing `FsListOptions.includeHidden` contract remains useful. Its semantic meaning changes to “include dot-hidden children.” No public contract shape change is required.

## Show hidden files

Settings owns a user preference `Show hidden files`.

When off:

- FileManager does not list dot-hidden entries;
- Desktop does not display dot-hidden entries;
- Search does not list or descend into dot-hidden directories;
- target metadata must not leak a hidden target name into visible Search results.

When on:

- dot-hidden resources are listed;
- they are searchable except for semantically excluded areas such as Recycle Bin contents;
- Agent 11 renders them subdued/greyed while keeping text readable and accessible.

`/System/.Trash` is a special semantic exclusion from normal Search even when hidden files are shown. Deleted content should not appear in ordinary Search just because the user enabled dotfiles.

## Rename/create confirmation

When a user creates or renames an ordinary user resource so its new name begins with `.`, show one confirmation:

```text
“.secret” will be hidden.
You can show hidden files again in Settings.

[Cancel] [Use hidden name]
```

If hidden files are currently off, the resource may disappear from the current view after confirmation. Provide a non-blocking notification/action pointing to `Show hidden files` so this does not look like data loss.

No confirmation is needed for internal system reconciliation that creates `.Properties.sys` or `.Trash`.

## Overrides

Do not let application code set a persistent “visible despite dot” or “hidden despite normal name” override for ordinary resources. That would reintroduce two truth sources.

Resource semantics can still exclude an internal area from a product surface for reasons other than hidden state. Recycle Bin contents are the primary example.

---

# 8. Desktop model

`/Desktop` is already a real filesystem-backed directory and should remain so.

Current Desktop position metadata is keyed by `NodeId` under `plasmon.desktop.positions.v1`. This is the correct identity choice and should be retained.

## Default Desktop resources

Seed once:

```text
Root         -> /
Apps         -> /Apps
Recycle Bin  -> /System/RecycleBin.sys
Doom         -> /Games/DOS Bundles/doom.jsdos
```

These are shortcuts, not magic React icons.

## Seed ledger

Desktop owns a versioned seeded-default ledger keyed by stable seed identity, for example conceptually:

```text
desktop.root
 desktop.apps
 desktop.recycle-bin
 desktop.doom
```

The exact metadata encoding is not a frozen contract.

Rules:

1. If a seed key has never been introduced, create it once.
2. Once introduced, mark the key as introduced.
3. Preserve user rename/move of the created shortcut.
4. If the user later deletes the shortcut, do not recreate it on refresh or upgrade.
5. A future release may introduce a new seed key without disturbing old entries.
6. Do not overwrite a user's item just because it has the same display name.

This is the same principle the current Start reconciler already approximates with seeded identities: absence after initial seed means intentional deletion.

## Icon positions

When a newly seeded Desktop item has no saved position, allocate the next free grid position and persist it.

Since a soft-deleted Desktop node keeps its `NodeId`, its old position metadata can be reused if restored to Desktop. Stale position entries can be garbage-collected later; they should not force identity changes.

## Opening Root and Apps

The Root and Apps shortcuts dereference to directories and open FileManager at the target `NodeId`.

They must not go through file associations, and FileManager must not expose an architectural error about Shell ownership.

---

# 9. Start Menu model

Start is a presentation of:

```text
/System/Start Menu
```

It is not an app registry with a filesystem decoration layered on top.

## Required directory, mutable contents

`/System/Start Menu` itself is a system-required anchor.

Its children are normal folders/shortcuts with one of two child ownership classes:

- one-time seeded defaults;
- managed installed-app entries.

Users may create folders, move entries, rename entries, and delete entries. Start reflects those operations immediately.

## Native Plasmon apps

Default Start entries for native apps should be shortcuts to their `.sys` resource (or an equivalent stable native target that resolves through the `.sys` resource for Properties/icon identity).

Do not duplicate internal apps as unrelated hardcoded entries.

Do not recreate the old `Accessories` category. Folder organization should be intentionally small and user-editable.

A reasonable default is:

```text
/System/Start Menu/
├── File Manager
├── Settings
├── Browser
├── Photos
├── Search
└── ...installed Neutron app shortcuts or an Apps folder if later desired
```

The exact default folder grouping is presentation polish. The architectural requirement is that all visible entries are filesystem resources.

## Neutron applications

Each installed app may receive one **managed Start shortcut** when first discovered.

The shortcut should carry internal seed/projection ownership metadata in addition to normal `plasmon.shortcut` metadata so reconciliation can distinguish it from a user-created shortcut to the same app.

Rules:

- app installed + never seeded/suppressed -> create managed entry;
- managed entry exists -> preserve user rename/move;
- user deletes managed entry -> record suppression; do not immediately recreate it;
- app upgrades -> keep existing entry and its user customization;
- app uninstalls -> remove only the managed automatic entry if it still exists;
- user-created shortcuts to the app are preserved and become unavailable/broken until the app returns;
- reinstall of an app whose automatic entry was explicitly suppressed should continue respecting that suppression unless the user chooses an explicit “add to Start” command.

This makes automatic entries coexist with user intent instead of fighting it.

## Migration from `/Start Menu`

The current Start root is `/Start Menu` and already contains user-modifiable filesystem resources.

Migration should move that directory under `/System` using `FsService.move()`, preserving its `NodeId` and child identities. If `/System/Start Menu` already exists because of a partial migration, merge conservatively and collision-name incoming entries rather than overwrite either tree.

Current `plasmon.shell.start.seeded.v1` suppression history must be translated/preserved so an upgrade does not resurrect entries the user already deleted, including the manually removed `Accessories` content.

## Launching

Start must stop maintaining a separate target-launch switch. It should hand the selected shortcut/resource to the shared filesystem open dispatcher described in section 6.

---

# 10. Program Files model

## Product goal

`/System/Program Files` should let users inspect stable resources/package information used to construct built-in Plasmon applications without exposing an unstable implementation dump.

## daedalOS lesson

daedalOS places curated runtime directories such as Monaco Editor, TinyMCE, Webamp, js-dos, EmulatorJs, and other static packages in its public `Program Files` tree. That works well for daedalOS because those public assets are intentionally part of its exposed filesystem/runtime surface.

Plasmon should borrow the **inspection concept**, not blindly copy the packaging mechanism.

## Recommended Plasmon representation

Use system-owned, read-only, curated package directories materialized through the existing `FsService`.

Example:

```text
/System/Program Files/MonacoEditor/
├── package.json          # curated package identity/version/source/license fields
├── README.txt            # short human-readable role in Plasmon
├── assets.json           # stable entry points/assets used by Plasmon
└── assets/               # only deliberately exposed stable assets, when practical
```

A package directory may expose:

- component/package name;
- version actually used by the build;
- upstream/source attribution;
- license notices that are already distributable;
- stable entry-point names;
- stable JS/WASM/CSS/assets that Plasmon deliberately ships as inspectable files when duplicating them is reasonable;
- an asset manifest describing bundled/static assets that cannot sensibly be copied into persistent storage.

Do **not** recursively copy:

- `node_modules`;
- Vite/webpack/transpiler temporary output;
- cache-busted build chunks merely because they exist;
- every transitive package;
- browser cache resources.

## Why not a new virtual filesystem

A read-only virtual package provider could model immutable packaged assets elegantly, but current `FsService` is a persistent storage abstraction and has no overlay/provider contract. Adding a second filesystem or an overlay purely for Program Files violates current constraints and would be a disproportionate architectural change.

If future product requirements demand byte-for-byte browsing of every packaged asset without persistent duplication, design that as a separate filesystem-provider project rather than smuggling it into this sprint.

## Upgrade behavior

Each curated package has a stable package key in metadata. Reconciliation updates managed files/directories in place where possible and preserves top-level package `NodeId` across upgrades.

Users cannot rename/move/delete/write/copy these managed package resources from normal UI. They may inspect Properties and open safe text/assets through associations.

## Initial package set

Include only components actually used:

- MonacoEditor
- Webamp
- TinyMCE
- js-dos
- EmulatorJs

`Video.js` is conditional, not architectural. If native Video playback does not depend on it, do not materialize it merely to match an earlier wishlist.

---

# 11. Recycle Bin model

## Visible app and internal storage

Visible system application:

```text
/System/RecycleBin.sys
```

Internal storage:

```text
/System/.Trash/
```

Desktop `Recycle Bin` is a shortcut to the `.sys` application, not a direct shortcut to `.Trash`.

## Use filesystem moves, not a tombstone-only store

Normal Delete should move the existing resource into the trash area. Moving preserves `NodeId`, blob references, timestamps, subtree identities, shortcut targets, and Desktop identity.

A tombstone-only delete/recreate design would either keep deleted nodes in place or require restoring from copied data with new IDs. A move-based design aligns better with the existing stable-ID model.

## Wrapper layout

Do not put all deleted files directly in `.Trash` because same-name collisions are inevitable.

Use one internal wrapper directory per deleted root, conceptually:

```text
/System/.Trash/
└── <unique-wrapper>/
    └── Report.md          # original node, same NodeId
```

Wrapper metadata records restoration information:

```ts
{
  "plasmon.trash": {
    format: "plasmon.trash",
    version: 1,
    trashedNodeId: "...",
    originalParentId: "...",
    originalName: "Report.md",
    originalPath: "/Documents/Report.md", // presentation/history only
    deletedAt: 1786470000000
  }
}
```

`originalParentId` is authoritative for restore. `originalPath` is a human-readable fallback/history field, not identity.

The wrapper is internal; Recycle Bin UI presents the child as `Report.md` with “Original location” and “Deleted” columns.

## Delete flow

For an ordinary file/directory/shortcut/local Atom:

1. classify resource and verify soft-delete is allowed;
2. create wrapper in `.Trash`;
3. record original parent/name/path/time;
4. move the original node into the wrapper;
5. if any step after wrapper creation fails, clean up empty wrapper where safe and surface the error;
6. refresh affected views.

`file-manager/delete.ts` is already a useful centralized seam. Replace its permanent-remove behavior with `TrashService` rather than changing every command surface.

## Restore

If `originalParentId` still exists outside Trash and the original name is free:

1. move the original node back to `originalParentId`;
2. preserve its `NodeId`;
3. remove the now-empty wrapper.

### Name collision

Polished behavior should show a conflict dialog with:

- Keep Both (default safe action; allocate familiar suffix)
- Replace, only if the conflicting destination resource can itself be deleted safely
- Cancel

An MVP may use a deterministic restored-name suffix rather than a full conflict dialog if needed, but it must never overwrite silently.

### Original parent missing

If the original parent no longer exists, or is itself still in Trash, do not restore inside the hidden trash tree.

Offer:

```text
Original location is unavailable.
[Restore to Desktop] [Choose Folder…] [Cancel]
```

MVP may default to Desktop with an explanatory notification if folder-picking is not ready.

## Permanent deletion

Deleting from the Recycle Bin permanently calls `FsService.remove()` on the trashed node/subtree and then removes its wrapper.

`Empty Recycle Bin` asks for confirmation and permanently removes all entries.

No normal FileManager surface outside Recycle Bin should call permanent `remove()` for user deletion after this migration.

## Protected resources

- `.sys`: never goes to Trash.
- `.neutron`: Delete is disabled; Uninstall is a Kernel flow and projection disappearance is permanent reconciliation, not Trash.
- system-required anchor: cannot be deleted.
- curated Program Files: cannot be deleted.
- ordinary Start/Desktop shortcut: can be trashed.

## Search and shortcuts

Normal Search excludes `.Trash` descendants regardless of `Show hidden files`.

A shortcut that targets a trashed node can identify that target by `NodeId`, but should show “Target is in Recycle Bin” rather than opening hidden trash content. Restore heals it automatically.

---

# 12. Properties model

Properties is where filesystem identity and application identity should become understandable to a user.

Do not show every internal field just because it exists.

## Ordinary file

Show:

- name;
- type;
- opens with;
- location;
- full path;
- size;
- created/modified;
- optional advanced details where useful.

Current content hash is implementation-oriented. Move it to an optional Advanced/details area instead of making it a primary field.

## Directory

Show:

- name;
- Type: Folder;
- location/path;
- created/modified;
- aggregate item count/size later if it can be computed without expensive foreground traversal.

Do not block Properties on a recursive size scan.

## Shortcut

Show prominently:

```text
Type: Shortcut
Target: /Apps/Mail.neutron
Target type: Neutron application
Status: Available
```

For a node target, resolve the current path dynamically from `NodeId`.

For an Element target, resolve the current `/Apps/*.neutron` projection. If uninstalled, show the app identity as unavailable rather than displaying a stale path.

For URL, show the URL.

Useful actions:

- Open Target
- Open Target Location, when a current filesystem location exists

Renaming Properties edits the shortcut's name, never the target.

## `.sys`

Show:

- app icon/name;
- Type: Plasmon system application;
- location/path;
- system-managed/protected status;
- relevant user-facing description if registered.

Do not offer rename, Open With, delete, size/hash trivia, or implementation handler IDs as primary fields. Handler/system IDs may appear only under Advanced diagnostics if useful.

## `.neutron`

Show available `ExternalElement` information:

- native Neutron app icon;
- display name;
- Type: Neutron application;
- description;
- version, if Kernel supplies it;
- running state if known and useful;
- location `/Apps`;
- Uninstall… action.

Do not show a meaningless zero-byte “application file size” or content hash as if this were the package archive.

The Element/app ID can be an Advanced identifier.

## Atom

Use current Atom contracts only. Show meaningful fields such as:

- title;
- Atom type;
- Atom ID where appropriate;
- local path/source node where applicable;
- handler/application.

Do not imply that local Delete revokes a remote share/authorization or deletes an external Atom unless the owning Atom/Sharing contract explicitly says so.

---

# 13. Search model

## Source of truth

Search should search the filesystem-visible resource model.

Because `.sys` and `.neutron` now have filesystem identity, Shell Search should stop returning a separate native-app/`ExternalElement` result for the same application in addition to its filesystem resource.

Registries remain useful for:

- enriching icons/descriptions;
- dispatching launch;
- resolving associations.

They should not form a second visible application inventory.

## Included resources

Search can return:

- ordinary files;
- directories;
- shortcuts;
- visible `.sys` apps;
- `.neutron` projections;
- Atoms;
- games/media according to associations/categories.

## Hidden state

When `Show hidden files` is off:

- use `includeHidden: false`;
- do not descend into dot-hidden directories;
- do not match hidden resource names;
- do not use a hidden shortcut target's resolved name as searchable text.

When on, hidden resources may be searched, except `.Trash` descendants remain excluded as deleted content.

## Shortcut matching

A shortcut can match:

1. the shortcut's own display name;
2. the visible target's current display name;
3. safe user-facing target description/type.

Do not index arbitrary shortcut metadata blobs.

The result represents the shortcut resource if the shortcut matched. Opening it dereferences through the shared open dispatcher.

## Semantic searchable fields

The current search implementation recursively stringifies arbitrary node metadata into searchable text. Stop doing that.

Search only user-meaningful fields provided by resource classification, for example:

- name;
- MIME/type label;
- Atom title/type;
- `.sys` app name/description;
- `.neutron` name/description;
- shortcut display name and permitted resolved target name.

This avoids leaking internal state and produces less surprising matches.

## Icons/thumbnails

- image/media file -> existing thumbnail mechanism where safe;
- `.sys` -> native system app icon;
- `.neutron` -> Kernel-provided app icon;
- shortcut -> target base icon + shortcut overlay;
- Atom -> Atom/app icon policy;
- directory -> folder icon.

Agent 11 owns actual artwork; Agent 6 owns Search use of the semantic icon model.

## Limit warning bug

The current Search path conflates multiple concepts into `truncated`:

- filesystem traversal safety limit;
- category result caps;
- total result cap.

The UX message “Search reached its local safety/result limit” must be tied to the reason that actually occurred.

Recommended internal result shape:

```ts
{
  results,
  warnings,
  limits: {
    traversalLimitHit: boolean,
    totalResultLimitHit: boolean,
    categoryLimitsHit: string[]
  }
}
```

Exact shape is internal Shell API, not a frozen OS contract.

A normal query with one result and an unexhausted traversal must not show any safety/result-limit warning.

---

# 14. Protected-operation matrix

Legend:

- **Yes** — normal operation.
- **Trash** — soft-delete to Recycle Bin.
- **No** — command disabled/not offered.
- **Conditional** — depends on current backing semantics noted below.
- **Bridge** — Neutron-owned flow, not filesystem mutation.
- **Later** — reasonable feature, not required for this sprint.

| Resource | Open | Rename | Move | Copy | Delete | Uninstall | Create shortcut | Pin | Download | Properties | Search |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ordinary file | Yes | Yes | Yes | Yes | Trash | No | Yes | Yes if launchable | Yes | Yes | Yes* |
| Ordinary directory | Yes | Yes | Yes | Yes | Trash | No | Yes | Yes | Later (archive) | Yes | Yes* |
| Shortcut | Target | Yes | Yes | Yes, shortcut only | Trash | No | Yes, flatten target | Yes | No | Yes | Yes* |
| `.sys` | Native via `OpenService` | No | No | No | No | No | Yes | Yes | No | Yes | Yes* |
| `.neutron` | `NeutronBridge` | No | No | No | No | Bridge | Yes | Yes | No | Yes | Yes |
| Atom | Existing handler | Yes | Yes | Conditional | Trash local node | No | Yes | Yes | Conditional | Yes | Yes* |

`*` Hidden resources are excluded while `Show hidden files` is off. Trash descendants are excluded regardless.

## Ownership overrides

The row “ordinary directory” does not make a system-required directory mutable. `/Desktop`, `/Apps`, `/System`, `/System/Start Menu`, `/System/Program Files`, and `/System/.Trash` receive a protected-anchor policy.

Seeded-default directories such as `/Documents` or `/Games` become user-manageable after initial creation.

## Atom caveats

Atom copy/export semantics are not fully specified by current contracts. For MVP:

- allow rename/move of the local filesystem representation;
- soft-delete the local representation only;
- disable semantic “clone Atom” behavior unless the Atom owner defines it;
- allow Download only when the backing local node has an explicitly serializable representation.

Do not infer remote authorization/storage effects from local filesystem actions.

---

# 15. Stable identity model

## NodeId is canonical filesystem identity

Paths are mutable presentation/navigation.

Current `FsService` already has the right primitive behavior:

- rename preserves `NodeId`;
- move preserves `NodeId`;
- `pathOf(id)` computes current presentation path;
- copy creates a new node/tree identity;
- permanent remove destroys node identity.

Keep those semantics.

## Shortcuts

A shortcut has two identities:

- its own `NodeId`;
- its target identity.

Filesystem target uses `NodeId`; Neutron target uses Element/app ID; native target can use stable handler ID; URL target uses URL.

No canonical shortcut target should be a mutable path string.

## `.sys`

- reconciliation key: stable `systemId`;
- filesystem instance identity: `NodeId`;
- preserve that node across upgrades;
- missing/corrupt recovery may recreate with a new `NodeId`, then repair Plasmon-managed references.

## `.neutron`

- canonical application identity: Kernel Element/app ID;
- filesystem projection identity: `NodeId`;
- preserve projection node while installed;
- uninstall legitimately removes projection identity;
- reinstall may allocate a new projection `NodeId`;
- Element-target shortcuts survive that lifecycle.

## Recycle Bin

Soft-delete is a move, so the deleted root and its subtree preserve `NodeId`.

Restoring moves the same nodes back. Permanent delete ends identity.

## Desktop

Position metadata keyed by `NodeId` remains correct across rename and soft-delete/restore.

## Start

Seed/managed-entry identity is based on target/seed key, not current path/name. User moving/renaming a Start shortcut must not make reconciliation think the app is missing.

## Seeded files

Example documents/media/games receive normal `NodeId`s once. Their seed ledger records “introduced,” not a perpetual desired pathname. After introduction they become user-owned.

---

# 16. Install/uninstall lifecycle

## Install

Neutron installation remains owned by the existing bridge/Kernel flow.

After installation is completed and `loadElements()` successfully includes the app:

```text
Kernel install state
    -> NeutronBridge.loadElements()
    -> app projection reconciler
        -> create/update /Apps/<Name>.neutron
        -> keep native Neutron icon metadata
        -> create managed Start shortcut if not suppressed
        -> emit/observe FS changes
        -> Desktop/Search/Start refresh normally
```

Installation must not automatically launch the app unless the existing Kernel install UX defines that behavior independently.

No `.neutron` projection is created as an optimistic substitute for confirmed installation.

## Open

```text
open /Apps/Mail.neutron
    -> classify projection
    -> elementId = mail
    -> NeutronBridge.openElement(mail)
    -> Kernel owns tile selection/reuse/runtime
```

## Uninstall

```text
Uninstall Mail…
    -> NeutronBridge.offerUninstall(mail)
    -> Neutron/Kernel confirmation flow
    -> projection remains while state is pending
    -> successful authoritative refresh no longer contains mail
    -> remove /Apps/Mail.neutron permanently
    -> remove managed Start entry
    -> keep user-created shortcuts/pins as unavailable references
```

If uninstall is canceled or fails, filesystem state remains installed.

If the bridge cannot determine authoritative state, preserve the projection and show an actionable refresh/error state. Do not infer uninstall from runtime “not running.”

## Reinstall

On reinstall with the same Element/app ID:

- create a new projection if the old one was removed;
- Element-target user shortcuts heal;
- user-created shortcuts remain user-owned;
- automatic Start entry is recreated only if it was not explicitly suppressed by the user.

---

# 17. Bootstrap / upgrade / reconciliation model

Current `PersistentFsService.initialize()` seeds a small directory list only when storage is completely new. That is insufficient for evolving system resources because existing profiles never receive later required resources or migrations.

Add a versioned **filesystem product bootstrap/reconciler** above `FsService`.

Do not put product application policy into the persistence repository.

## Run point

Run after `FsService` is ready and before Shell/Desktop treat filesystem layout as initialized.

It may use only `FsService` methods and bridge/registry metadata; it must not access repository persistence directly.

## Class 1: system-required

Examples:

- `/Desktop`
- `/Apps`
- `/System`
- required `.sys`
- `/System/Start Menu`
- `/System/Program Files`
- `/System/.Trash`
- curated Program Files package directories

Rules:

- ensure present;
- enforce protected ownership metadata;
- reconcile canonical managed type/metadata;
- update managed presentation metadata/icon/version in place;
- preserve `NodeId` when resource exists;
- recreate if missing;
- remove/retire only through an explicit migration, not because a transient registry call failed.

## Class 2: seeded-default

Examples:

- Desktop Root/Apps/Recycle Bin/Doom shortcuts;
- example Documents/Music/Pictures/Videos files;
- game/ROM seed files;
- default native Start shortcuts.

Rules:

- each stable seed key is introduced at most once;
- after introduction, user owns rename/move/delete;
- absence means intentional deletion;
- never recreate merely because an upgrade still lists the seed;
- new release may add a previously unseen seed key.

## Class 3: installed-app projection

Kernel list is authority.

Rules:

- reconcile by Element/app ID;
- preserve projection `NodeId` while installed;
- update managed display metadata;
- create missing projections only from successful authoritative discovery;
- remove stale projections only after successful authoritative discovery proves absence;
- preserve projections during bridge failure/unknown state.

## Class 4: user-owned

Never reconcile user content as desired-state resources.

Migration may transform schema/metadata with a defined compatibility rule, but upgrade code must not recreate or relocate user content just to make the default tree aesthetically match a new release.

## Idempotence

Every bootstrap/reconciliation pass must be idempotent.

Repeated startup/refresh may repair required state, but must not:

- duplicate defaults;
- duplicate Start entries;
- reset Desktop positions;
- rename user shortcuts;
- recreate deleted seeded resources;
- churn `NodeId`s;
- remove `.neutron` projections on transient errors.

---

# 18. Migration from current implementation

Migration should be explicit and versioned. Do not rely on “fresh filesystem only” initialization.

Recommended sequence:

1. **Inventory without mutation.** Resolve current `/`, `/Desktop`, `/System`, `/Start Menu`, existing seed metadata, and known user roots.
2. **Make `/System` visible.** Remove the legacy `hidden: true` bootstrap treatment from the System directory. The new hidden convention is dot-name based.
3. **Preserve compatibility roots.** Do not delete `/Downloads` or `/Shared`. `/Shared` remains sharing-owner territory.
4. **Ensure required anchors.** Add `/Apps`, `/System/Program Files`, and `/System/.Trash` as needed. Keep existing `/Desktop` and `/System` nodes where present.
5. **Move Start.** Move existing `/Start Menu` to `/System/Start Menu` preserving its `NodeId`. If both locations exist, merge without overwriting and retain all child IDs where possible.
6. **Preserve Start suppression history.** Translate current `plasmon.shell.start.seeded.v1` state so previously deleted entries are not resurrected.
7. **Unify shortcut parsing.** Current Start and FileManager implement closely related `plasmon.shortcut` parsing separately. Move to one shared implementation without changing compatible v1 metadata.
8. **Create/reconcile `.sys` resources.** Bind system-app IDs to existing native handlers.
9. **Reconcile `.neutron` projections.** Create `/Apps/*.neutron` from authoritative bridge state. Do not launch apps.
10. **Seed Desktop defaults once.** Root, Apps, Recycle Bin, Doom; record seed keys before normal runtime refresh loops can run.
11. **Seed example user resources once.** Documents/media/games packages are seeded-default, not required state.
12. **Switch hidden semantics.** `FsService.list(includeHidden)` uses dot names. Any known legacy hidden metadata owned by Plasmon is converted/removed during migration rather than retained as a second truth source.
13. **Switch open dispatch.** FileManager/Start/Search/Desktop all invoke the shared dispatcher; remove the user-facing Shell-owned shortcut error.
14. **Switch Delete boundary to Trash.** Only Recycle Bin permanent-delete path uses `FsService.remove()` for normal user content.
15. **Switch Start/Search visible app inventory.** Stop parallel hardcoded native/Element visible results once `.sys`/`.neutron` filesystem projections are ready.

## Legacy hidden metadata caution

The known fresh-filesystem use of `metadata.hidden` marks `/System`. If an audit finds other production code persisting user hidden flags, do not silently expose those users' files. Convert them with a one-time compatibility migration (prefer a dot-prefixed name only with a collision-safe policy) or temporarily honor legacy metadata until that migration can safely complete. Do not leave both conventions indefinitely.

---

# 19. Windows / macOS / daedalOS UX lessons

## Shortcuts / aliases

Windows Shell Links and macOS aliases reinforce a useful rule: the shortcut/alias is a separate object from its target. Removing or moving the shortcut does not remove/move the target, and opening the shortcut opens the referenced target.

Plasmon should preserve that expectation while using `NodeId`/Element identity instead of legacy filesystem path strings.

## Send to Desktop

Windows' familiar “Send to > Desktop (create shortcut)” behavior maps cleanly to Plasmon: create a shortcut node under `/Desktop`; do not copy/move the target.

## Recycle Bin / Trash

Windows Restore and macOS Put Back both establish the expected mental model: deletion is recoverable and restore attempts to return the item to its former location.

Plasmon's move-based trash model adds the stronger internal property that the same `NodeId` survives delete/restore.

## daedalOS filesystem-backed UI

daedalOS is especially useful as a web-desktop reference because its public filesystem includes:

- a real `Program Files` tree with runtime packages such as Monaco Editor, TinyMCE, Webamp, js-dos, and EmulatorJs;
- a public-user Desktop directory;
- a filesystem Start Menu directory with `.url` shortcut resources;
- File System UX including create shortcut, delete, rename, Open With, Properties, and persisted desktop icon positions.

Lessons to keep:

- Desktop/Start should be backed by filesystem resources rather than duplicate registries;
- application resources can be usefully inspectable;
- shortcuts should have their own filesystem representation;
- icon position persistence belongs to filesystem-visible Desktop identity.

Lessons **not** to copy literally:

- Plasmon should not mirror every public/static build artifact into persistent `FsService` storage;
- `.url` is not required as Plasmon's universal shortcut encoding because `kind: "shortcut"` plus structured target metadata is already stronger;
- daedalOS packaging details do not override Plasmon's Neutron/Kernel execution boundaries.

---

# 20. Contracts / interfaces affected

This section distinguishes frozen OS contracts from implementation/internal APIs.

## Frozen contracts used

- `FsNode`, `FsNodeKind`, `FsListOptions`, `FsService`, `FsEvent`, `FsEventSource`
- `NodeId`, `HandlerId`, `IconRef`, `JsonValue`
- `NativeAppDefinition`, `NativeAppRegistry`
- `AssociationRegistry`, `HandlerDefinition`, `AtomDescriptor`, `OpenService`
- `ExternalElement`, `NeutronBridge`

## Internal implementation areas affected

- `os/fs/service.ts` — dot-hidden listing semantics; product bootstrap no longer limited to fresh-store defaults.
- new filesystem resource classifier/policy module — `.sys`, `.neutron`, ownership, protected operations.
- new product bootstrap/reconciler module — required resources, seed ledgers, projection reconciliation, migration.
- new shared filesystem open dispatcher — directories/shortcuts/sys/neutron/ordinary/Atom/URL.
- `file-manager/shortcut.ts` — becomes the shared canonical shortcut parser/model rather than FileManager-only helper.
- `file-manager/delete.ts` — soft-delete boundary backed by Trash service.
- `file-manager/FileManager.tsx` — policy-aware commands, shared open dispatcher, hidden preference, create shortcut/send-to.
- `file-manager/properties.tsx` / native Properties app — resource-specific Properties.
- `desktop/Desktop.tsx` — one-time default seed/reconciliation; current position storage remains.
- `shell/startMenu.ts` — path migration, no duplicate shortcut model/launch switch, managed-entry reconciliation.
- `shell/search.ts` — filesystem resource taxonomy, hidden setting, semantic fields, limit reasons, visible app dedupe.
- Neutron vanilla/mock bridge — uninstall-flow adapter after contract approval.
- native Settings — show-hidden preference.
- native Recycle Bin — Trash listing/restore/empty UX.
- icon/presentation modules — Agent 11 semantic icons/overlays.

---

# 21. Exact existing contracts that are sufficient

## `FsNode` / metadata

Sufficient for `.sys`, `.neutron`, ownership tags, seed keys, Program Files package metadata, Trash wrapper metadata, and shortcuts.

No new `FsNodeKind` is necessary.

## `FsService.stat()` / `pathOf()` / `resolvePath()` / `list()`

Sufficient for:

- stable-ID lookup;
- dynamic path display in Properties;
- reconciliation;
- target resolution;
- hidden listing through existing `includeHidden` option;
- Start/Desktop directory views.

`includeHidden` needs implementation-semantic adjustment to dot names, not a type/interface change.

## `FsService.mkdir()` / `createFile()` / `setMetadata()`

Sufficient for required resources, seed defaults, projections, shortcut files, Program Files manifests, and Trash wrappers.

## `FsService.rename()` / `move()` / `copy()` / `remove()`

Sufficient primitives.

- move preserves `NodeId` and enables soft-delete/restore;
- copy creates new identity;
- remove remains available for permanent Recycle Bin deletion and explicit system reconciliation cleanup.

Protected-operation policy belongs above `FsService`; the storage contract does not need application-specific `canDelete` flags.

## `FsEventSource`

Sufficient for Desktop/FileManager/Search refresh invalidation after bootstrap/trash/projection changes.

## `NativeAppRegistry`

Sufficient to bind `.sys` resource metadata to names/icons/handlers and to validate native handler identity.

## `AssociationRegistry` + `OpenService`

Sufficient for ordinary files, supported Atoms, native handler launch, and URL/browser dispatch. No duplicate file-opening service should be invented.

## `NeutronBridge.loadElements()` / `openElement()` / `subscribe()`

Sufficient for installed-app discovery, `/Apps` projection reconciliation, runtime refresh, and opening `.neutron` through Kernel.

## Existing `plasmon.shortcut` v1 metadata

Sufficient target vocabulary for file/directory/system app/Neutron app/Atom/game/URL use cases. The problem is duplicated ownership/dispatch, not missing target types.

---

# 22. Exact contract changes required, if any

One minimal frozen contract amendment is required to satisfy the requested `.neutron` Uninstall behavior without violating the Neutron boundary.

Current `NeutronBridge` exposes:

```ts
loadElements()
openElement()
offerInstall()
refreshRuntimeState()
subscribe()
```

It exposes no uninstall action.

Recommended amendment:

```ts
export interface NeutronBridge {
  // existing members...
  offerUninstall(appId: string): Promise<void>;
}
```

The name `offerUninstall` is intentional: Plasmon requests/launches the Neutron-owned uninstall flow; Plasmon does not delete Kernel installation state itself.

Agent 8 must first bind this to the actual Kernel/neutron-tools uninstall API/UX. If upstream Neutron currently exposes no uninstall flow, that is an external dependency and the `.neutron` Uninstall command remains blocked. Plasmon must **not** work around the missing Kernel capability by deleting `/Apps/<app>.neutron`.

No other frozen contract amendment is required by this design.

In particular, do **not** change `FsNodeKind`, do not add fixed-ID creation to `FsService`, and do not add a second storage/provider contract merely for Program Files in this sprint.

---

# 23. Division of implementation ownership

The work packages below are intentionally split by existing ownership. `Desired` and `Size` use the requested non-numeric labels.

| Owner / package | Scope | Desired | Size | Dependencies |
|---|---|---|---|---|
| Filesystem/core A | Resource classifier + ownership/protected-operation policy; shared collision naming; semantic metadata validators | MUST | Medium | Design approval |
| Filesystem/core B | Shared filesystem open dispatcher; unify shortcut parser/targets; cycle/broken/trashed handling | MUST | Medium | Core A; existing OpenService/NeutronBridge |
| Filesystem/core C | Versioned bootstrap/migration/reconciler; required anchors; `.sys`; seed ledgers; move Start; dot-hidden semantics | MUST | Big | Core A; native registry |
| Filesystem/core D | `/Apps` projection reconciler keyed by Element ID | MUST | Medium | Core A/C; Agent 8 bridge state |
| Filesystem/core E | Trash service, wrapper metadata, restore/permanent delete/empty primitives | MUST | Big | Core A/C |
| Filesystem/core F | Curated `/System/Program Files` package materializer | HIGH | Medium | Core C; actual native package inventory |
| Filesystem/core G | Seed example Documents/Music/Pictures/Videos content and preserve one-time intent | NORMAL | Small | Core C; distributable sample assets |
| Agent 5 Desktop/FileManager | Policy-aware context/keyboard operations; shared open; Create shortcut; Send to Desktop; hidden toggle plumbing; soft-delete integration; Desktop seed presentation/positions | MUST | Big | Core A/B/C/E |
| Agent 6 Shell/Search | `/System/Start Menu` view/reconcile; remove duplicate launch path; filesystem-backed app Search; hidden/trash filtering; semantic search fields; limit-reason bug; result icons | MUST | Big | Core B/C/D; Agent 11 icon contract |
| Agent 7 native apps | Settings Show Hidden Files; resource-specific Properties; Recycle Bin native app UI; `.sys` definitions/metadata descriptions; direct `.Properties.sys` empty state | MUST | Big | Core A/C/E; Agent 8 for Neutron uninstall Properties action |
| Agent 8 Neutron bridge | Minimal `offerUninstall(appId)` contract/adapter; mocks/tests; ensure projection refresh follows Kernel authoritative state | MUST | Small if upstream API exists; otherwise Medium/blocking | Frozen-contract approval; actual Kernel uninstall API |
| Agent 11 visual system | Native `.sys` icons; retained Neutron icons; target-derived shortcut base icon + overlay; hidden subdued treatment; broken shortcut/protected/Recycle Bin states | HIGH | Medium | Core semantic categories; Agent 5/6 rendering hooks |
| Agent 12 games | Seed/association contract for `/Games/DOS Bundles` and `/Games/Roms`; save boundary `/Games/Saves`; ensure games open through shared association/open path | HIGH | Medium | Core C/B; game subsystem implementation |

## Filesystem/core boundary

Core owns semantics and services, not GUI artwork or native app UI.

It should provide operations such as:

```text
classify resource
open resource
authorize/describe command capabilities
create shortcut
move to trash
restore trash item
reconcile required resources
reconcile Neutron projections
```

FileManager/Shell should call those boundaries instead of duplicating rules.

## Agent 5 boundary

Agent 5 should not reimplement semantic detection by extension. It consumes resource capabilities and the shared dispatcher.

It owns the familiar interaction surfaces: menus, keyboard, drag/drop restrictions, Create shortcut, Send to Desktop, soft-delete feedback, and desktop placement.

## Agent 6 boundary

Agent 6 owns Start/Search presentation and shell integration. It should delete/consolidate the current duplicate Start shortcut parser/launch switch only after the shared dispatcher exists.

Search should consume filesystem resource semantics, not re-create an app registry.

## Agent 7 boundary

Agent 7 owns system apps that make the semantics understandable: Settings, Properties, Recycle Bin. It must not own storage/reconciliation rules.

## Agent 8 boundary

Agent 8 owns only the bridge/API surface necessary to request Neutron uninstall and refresh authoritative state. It does not own `/Apps` filesystem storage or FileManager UI.

## Agent 11 boundary

Agent 11 receives semantic visual requirements, not filesystem architecture:

- resource icon categories;
- shortcut overlay rules;
- hidden visual treatment;
- protected/system visual hints;
- broken target state;
- Recycle Bin empty/full state if desired.

## Agent 12 boundary

Agent 12 receives filesystem placement/association/save boundaries. It does not create a second launch dispatcher or bypass file associations/OpenService.

---

# 24. Recommended implementation order

1. **Approve this semantic model and the minimal NeutronBridge uninstall amendment.** Do not start UI work that would force a different app identity model later.
2. **Filesystem/core A — resource classifier/policy.** Every later surface needs one answer to “what is this node and what can I do to it?”
3. **Filesystem/core B — shared open dispatcher + canonical shortcut module.** This immediately removes the most visible broken shortcut boundary and prevents Start/FileManager divergence.
4. **Filesystem/core C — bootstrap/migration + `.sys` + dot-hidden semantics.** Establish the actual tree and preserve existing user intent before adding projections/defaults.
5. **Filesystem/core D + Agent 8 — `.neutron` projection and uninstall bridge.** Make `/Apps` authoritative as a view of Kernel state without changing execution ownership.
6. **Agent 5 + Agent 6 — Desktop/Start integration.** Seed defaults once, move Start under System, route all openings through the shared dispatcher, and enforce policies in menus/keyboard/drag.
7. **Filesystem/core E + Agent 7 — Recycle Bin.** Change Delete to soft-delete, then ship restore/empty UI. Do not leave a period where `.sys`/`.neutron` can be permanently deleted through generic FileManager commands.
8. **Agent 7 + Agent 6 — Properties/Search convergence.** Resource-specific identity, hidden setting, semantic search text, app dedupe, and accurate limit warnings.
9. **Filesystem/core F + Agent 12 — Program Files and games/assets.** Materialize only packages/assets that have a stable product contract and wire games through associations.
10. **Agent 11 — visual pass across completed semantic states.** Artwork can begin earlier, but final integration should happen after states/overlays are stable.

Parallelism is possible after steps 2-4. The ordering describes dependency, not a requirement that every agent work serially.

---

# 25. MVP requirements versus later polish

## MUST for the next filesystem sprint

- one resource classifier/protected-operation policy;
- `.sys` filesystem resources for required Plasmon apps;
- `/Apps/*.neutron` installed-app projection;
- minimal Neutron uninstall-flow bridge amendment and UI path;
- one shared shortcut parser and open dispatcher used by FileManager/Desktop/Start/Search;
- removal of the user-facing “Shortcut launch dispatch is owned by Shell” failure;
- dot-name hidden semantics + Settings toggle + Search integration;
- `/Desktop` one-time default shortcuts with deletion/rename/move intent preserved;
- Start migrated to `/System/Start Menu` and no hardcoded parallel native/Neutron visible registry;
- protected Delete/Rename/Move/Copy rules for `.sys`/`.neutron`;
- soft-delete to `/System/.Trash` with restore and empty/permanent-delete paths;
- resource-specific core Properties for shortcut/`.sys`/`.neutron`/Atom where supported;
- Search app/resource convergence and accurate truncation reason;
- versioned bootstrap/migration/reconciliation preserving existing user data and current Start suppression intent;
- tests covering identity preservation and upgrade idempotence.

## HIGH

- polished restore collision dialog with Keep Both/Replace/Cancel;
- curated Program Files package surface;
- retained Neutron icons and complete shortcut overlay states;
- game tree/associations/save boundary integration;
- rich but inexpensive Recycle Bin columns/status;
- Open Target Location in shortcut Properties.

## NORMAL

- complete example Documents/Music/Pictures/Videos seed set;
- richer Properties descriptions/advanced diagnostics;
- richer Search thumbnails/type subtitles;
- user-facing “Add to Start” command for suppressed managed app entry.

## LATER

- directory Download as generated archive;
- Shift+Delete/permanent-delete keyboard path outside Recycle Bin;
- virtual read-only provider for byte-for-byte packaged Program Files assets;
- custom shortcut icons;
- broken-shortcut target repair chooser;
- expensive recursive folder-size calculations;
- semantic Atom clone/export until Atom owner defines contracts;
- Video.js Program Files entry unless native Video actually adopts it.

---

# 26. Unresolved questions

These are implementation/dependency questions, not reasons to redesign the filesystem model.

1. **What exact Neutron/Kernel API launches uninstall?** The Plasmon bridge currently has no uninstall method. Agent 8 must verify the upstream API before implementation. If none exists, uninstall is blocked on Neutron rather than emulated in Plasmon.
2. **Does current sharing code require `/Shared` as a stable path?** Agent 10 intentionally does not move/delete it. Sharing owner must decide its eventual placement/lifecycle.
3. **Which example media/document/game assets are licensed and already available for redistribution?** Architecture treats them as seeded-default content; asset selection is an implementation/package decision.
4. **Which Program Files assets should be materialized as bytes versus listed in an inspectable manifest?** Decide per package based on stability/size/build packaging. Do not introduce a virtual filesystem in this sprint.
5. **Does any production/legacy code persist `metadata.hidden` for user-created resources beyond the known `/System` bootstrap?** Audit before removing compatibility handling. The target model remains dot-name hidden.
6. **Should Start initially be flat or have a small `Apps`/`System` grouping?** Both are presentation-compatible because the directory is user-editable. Do not reintroduce `Accessories` or a hardcoded registry.
7. **For MVP restore collisions, can Agent 7/5 ship the full Keep Both/Replace/Cancel dialog immediately, or should the first slice use deterministic collision suffixing?** Either preserves data and does not affect identity architecture.

None of these choices justifies changing `FsNodeKind`, making path canonical identity, bypassing `FsService`, or creating another app runtime.

---

# Current-code evidence at the starting SHA

The design above is based on the repository at `3dc25e00511c9070165560e324aba3cc31235a8e`:

- `contracts/fs.ts` already provides stable `NodeId`, `FsNode.metadata`, `kind: file|directory|shortcut|atom`, `includeHidden`, and all required primitive mutations.
- `fs/service.ts` preserves node identity on rename/move, currently permanently removes on `remove()`, currently filters hidden by metadata, and currently seeds only a small fresh-store directory set.
- `file-manager/delete.ts` explicitly centralizes permanent deletion behind a boundary intended for a future Recycle Bin.
- `file-manager/shortcut.ts` already defines the shared-compatible `plasmon.shortcut` v1 target vocabulary.
- `shell/startMenu.ts` currently duplicates shortcut target parsing/launch logic, uses `/Start Menu`, and already preserves seeded-entry deletion intent.
- `FileManager.tsx` currently refuses to dereference a valid shortcut and leaks the Shell-ownership error to the user.
- `desktop/Desktop.tsx` already uses a real `/Desktop` directory and persists positions keyed by `NodeId`.
- `shell/search.ts` currently traverses with hidden resources excluded, stringifies arbitrary metadata for search, and conflates traversal/result caps into a single `truncated` signal.
- `contracts/neutron.ts`/the vanilla bridge already support installed-app discovery and Kernel-owned reuse/opening, but have no uninstall-flow method.

That evidence is why this document recommends composition/reconciliation above existing contracts rather than a filesystem redesign.
