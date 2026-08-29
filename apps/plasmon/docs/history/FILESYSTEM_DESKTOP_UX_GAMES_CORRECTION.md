# Filesystem / Desktop UX — Games Correction

Status: **normative amendment** to `FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`  
Scope: games/runtime `.sys` boundary and temporary hackathon/demo-content seeding only  
No other filesystem architecture decisions are changed.

This amendment supersedes only conflicting games-related wording in `FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`.

## 1. `.sys` boundary — no game-runtime facades

Do **not** create, bootstrap, reconcile, or reserve:

```text
/System/DOS.sys
/System/Emulator.sys
```

or equivalent `.sys` facades for js-dos or EmulatorJS.

The `.sys` model remains restricted to **actual Plasmon-native applications/dialogs** such as FileManager, Settings, Start, Search, Photos, Browser, Recycle Bin, and hidden Properties.

js-dos and EmulatorJS are already the programs/runtimes that execute the supported game content. They belong under the existing curated Program Files model:

```text
/System/Program Files/js-dos/
/System/Program Files/EmulatorJs/
```

Their launch integration is through **normal association handler registrations**, not `.sys` resources.

Conceptually:

```text
/Games/DOS Bundles/example.jsdos
    -> AssociationRegistry
    -> js-dos handler
    -> runtime backed by /System/Program Files/js-dos

/Games/Roms/example.nes
    -> AssociationRegistry
    -> EmulatorJS handler
    -> runtime backed by /System/Program Files/EmulatorJs
```

The exact supported ROM extensions and handler mappings remain Agent 12 game-subsystem responsibility.

No game filename is part of launch semantics. Doom is content, not a handler, application identity, or architectural special case.

### Consequences for the main architecture

Where `FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md` says `.sys` is for a Plasmon-native system application/dialog, that remains authoritative.

Program Files remains an inspection/package surface for the actual runtime packages. The presence of js-dos or EmulatorJS under Program Files is **not** evidence that they also need `.sys` nodes.

The shared filesystem open dispatcher still follows the same normal-file branch for game files:

1. `stat()` the game file;
2. resolve its registered association(s);
3. select/default the normal js-dos or EmulatorJS handler;
4. invoke that handler through the existing association/OpenService integration;
5. let the handler use its Program Files runtime package.

Do not hard-code `doom.jsdos`, Doom, DOS, NES, or any other game/content name into the dispatcher.

## 2. Seed taxonomy correction

The architecture must distinguish two different kinds of shipped content seed:

### Durable product/system seed

A resource whose introduction is part of the intended durable Plasmon product experience.

Examples include system-required resources and genuinely product-owned default resources whose existence is meant to survive beyond the hackathon build.

Durable seeded-default resources use the normal user-intent ledger:

```text
never introduced
    -> seed once

introduced and still present
    -> preserve user rename/move/content intent

introduced and later deleted
    -> do not recreate on upgrade
```

### Temporary hackathon/demo-content seed

A development/hackathon resource intentionally bundled for demonstration even when its long-term redistribution/product status has not yet been cleared.

Examples may include the intended game/ROM demo files and their temporary convenience shortcuts.

Temporary demo seeds are **not permanent product bootstrap invariants**.

They need a separately identifiable seed namespace/manifest, conceptually:

```text
seed class: demo-temporary
seed set/version: hackathon-2026
seed key: game.doom
```

Exact metadata names are implementation details.

The important semantics are:

1. A hackathon/development build may seed the configured demo content if that content is bundled in that build.
2. Re-running the same hackathon build must remain idempotent and must not duplicate resources.
3. User rename/move/delete intent still wins while the demo seed exists.
4. A later product build can retire the **seed definition** without treating the resource as required state.
5. Retiring a demo seed must **not** delete a user's surviving copy or recreate a deleted copy.
6. A retired demo seed must not leave a normal durable seed ledger rule that causes the resource to fight removal from future product builds.
7. Demo content must never be used as a runtime/association identity.

The clean implementation is to keep durable seed provenance and temporary-demo seed provenance distinct rather than putting both into one undifferentiated “default forever” manifest.

## 3. Hackathon Games tree

For the current hackathon/development build, the intended examples may be made available under the normal Games tree when the files are present in the build/package inputs, including content whose redistribution clearance will be resolved later.

The intended shape remains compatible with:

```text
/Games/
├── DOS Bundles/
│   ├── doom.jsdos
│   ├── dn3d.jsdos
│   └── w3d.jsdos
├── Roms/
│   ├── Alter Ego.nes
│   ├── Anguna.gba
│   ├── Mega Qbert.gen
│   ├── School Rush.nds
│   ├── Halo 2600.a26
│   └── Classic Kong.smc
└── Saves/
```

This tree describes **hackathon/demo content**, not a promise that every named file is a permanent production seed.

A product cleanup can later remove/replace a demo asset from the shipped seed manifest without changing filesystem semantics, associations, handlers, Program Files, or user-owned existing files.

## 4. Desktop Doom shortcut

The main architecture's unconditional durable Desktop seed:

```text
Doom -> /Games/DOS Bundles/doom.jsdos
```

is superseded by this rule:

> A **temporary hackathon/demo Desktop Doom shortcut is allowed only when the intended Doom target exists in the current hackathon content**.

It is not a permanent product Desktop bootstrap invariant.

Recommended behavior:

```text
hackathon build + Doom target exists + demo shortcut never seeded
    -> create temporary Doom shortcut

hackathon build + user deleted/renamed/moved shortcut
    -> preserve user intent; do not fight it

later production build retires Doom demo seed
    -> stop offering/seeding the demo shortcut
    -> do not delete a surviving user shortcut as an upgrade side effect
    -> do not recreate a previously deleted shortcut
```

The shortcut remains a normal `plasmon.shortcut` node target pointing to the game file `NodeId`. Opening it therefore follows the same association path as double-clicking the game itself.

There is no special `openDoom()` path and no game-name branch in FileManager, Shell, OpenService, or the game handler.

## 5. Bootstrap / reconciliation amendment

The product bootstrap/reconciler should therefore operate with five lifecycle classes for this sprint:

1. **system-required** — must exist and is repaired/reconciled;
2. **durable seeded-default** — introduced once, then user intent wins;
3. **temporary demo-content seed** — introduced only for the configured development/hackathon seed set and can later be retired from shipping without becoming required state;
4. **installed-app projection** — mirrors authoritative Kernel state;
5. **user-owned** — never reconciled as desired product state.

Temporary demo retirement is a change to what future builds *offer*, not an instruction to delete user filesystem nodes that already exist.

This distinction supersedes places in the main document that group all example game content and the Doom Desktop shortcut together with durable seeded-default product content.

## 6. Program Files amendment

The main Program Files package set remains valid:

```text
/System/Program Files/MonacoEditor/
/System/Program Files/Webamp/
/System/Program Files/TinyMCE/
/System/Program Files/js-dos/
/System/Program Files/EmulatorJs/
```

For games specifically:

- `js-dos` is the DOS-bundle program/runtime;
- `EmulatorJs` is the ROM/emulator program/runtime;
- they register or back normal association handlers;
- they do not gain `.sys` facades;
- their Program Files representation stays system-owned/read-only under the existing architecture;
- game saves remain under the Agent 12-defined `/Games/Saves` boundary, not Program Files.

## 7. Agent 12 corrected contract

Agent 12 should receive this exact filesystem boundary:

### MUST

- register/use ordinary associations for supported DOS bundle and ROM formats;
- route opening through the existing association/OpenService architecture;
- use js-dos from `/System/Program Files/js-dos` as the DOS runtime/program;
- use EmulatorJS from `/System/Program Files/EmulatorJs` as the emulator runtime/program;
- keep save-state/data placement within the agreed `/Games/Saves` boundary;
- treat hackathon game files as temporary demo-content seeds when they are not yet durable product content;
- permit a temporary Doom Desktop shortcut only when its target is actually present;
- keep all game launch behavior file-type/association driven.

### MUST NOT

- create `DOS.sys`;
- create `Emulator.sys`;
- invent any other `.sys` wrapper merely because a Program Files runtime needs an association handler;
- hard-code Doom or any other game name into launching semantics;
- bypass associations with a game-specific FileManager/Shell launch path;
- make temporary demo game files permanent product bootstrap invariants;
- delete surviving user files merely because a later product build retires a demo seed.

## 8. Priority / sizing impact

No broad reprioritization is required.

The previously assigned Agent 12 Games package remains:

```text
Desired: HIGH
Size: Medium
```

The corrected work is simpler at the filesystem boundary because there are no game-runtime `.sys` resources to bootstrap, protect, reconcile, icon-map, or dispatch.

Filesystem/core's seed/reconciliation package gains one narrow MUST requirement: distinguish `demo-temporary` seed provenance from durable seeded-default provenance. This does not require a frozen contract change and remains within the already-sized bootstrap/migration work.

## 9. Frozen-contract impact

**None.**

This correction does not require changing:

- `FsNodeKind`;
- `FsService`;
- `AssociationRegistry`;
- `OpenService`;
- `NativeAppRegistry`;
- `NeutronBridge`;
- shortcut v1 metadata.

The only frozen-contract amendment identified by the main architecture remains the unrelated Neutron uninstall-flow gap.

## 10. Authoritative summary

For implementation planning, use the following rules:

```text
.sys
    = Plasmon-native application/dialog filesystem identity only

js-dos
    = Program Files runtime + normal association handler

EmulatorJS
    = Program Files runtime + normal association handler

game file
    = ordinary filesystem file opened through associations

Doom
    = optional temporary hackathon/demo content, never launch semantics

temporary demo seed
    = build/profile seed provenance that may be retired later without
      becoming required state or fighting user intent
```

Everything else in `FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md` remains unchanged.