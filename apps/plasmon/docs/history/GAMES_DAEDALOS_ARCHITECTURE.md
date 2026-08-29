# Plasmon Games / daedalOS Architecture

Status: design-first hackathon MVP recommendation, corrected by Coordinator A  
Research date: 2026-08-11  
Plasmon starting point: `3dc25e00511c9070165560e324aba3cc31235a8e`  
daedalOS source inspected: `DustinBrett/daedalOS@0df82d75e6114727ad035f6fce93842a96682355`

This document is a research/design handoff. It deliberately does **not** implement the game subsystem, change frozen OS contracts, or import game/ROM binaries.

## 1. Executive summary

Plasmon should make games ordinary filesystem resources opened through the existing association/OpenService path, not a separate hard-coded games launcher.

Correct conceptual launch path:

```text
game file
  -> ordinary AssociationRegistry resolution
  -> js-dos or EmulatorJS handler registration
  -> lazily loaded runtime/assets under /System/Program Files
  -> game window/session
```

The runtime split is:

```text
.jsdos
  -> js-dos handler
  -> /System/Program Files/js-dos

ROM extension
  -> EmulatorJS handler
  -> /System/Program Files/EmulatorJs + selected core
```

### Critical `.sys` distinction

**Do not create `DOS.sys`, `Emulator.sys`, or a `Games.sys` facade.**

js-dos and EmulatorJS are already the programs/runtimes. Their association handlers route an `OpenTarget` into those runtimes. A handler registration does **not** require a corresponding `.sys` filesystem application.

`.sys` is reserved for a Plasmon-native application where Plasmon itself supplies the program/application identity. It must not become a wrapper convention for every runtime or library under `/System/Program Files`.

If the current `HandlerDefinition.kind` value used by the integration is `native`, that is local OpenService routing metadata only. It must **not** be interpreted as requiring a `.sys` node.

Keep two runtime handler registrations because js-dos and EmulatorJS have materially different package formats, persistence APIs, runtime assets, input behavior, and save semantics. Keep only one EmulatorJS handler for all supported ROM systems; it selects the system/core from file type. Do not create one handler/program per console.

The target is **daedalOS game-format parity**, not a convenience subset. Every game content type used by the known daedalOS js-dos/EmulatorJS demo set is a hackathon parity requirement:

- `.jsdos` — Doom, Duke Nukem 3D, Wolfenstein 3-D;
- `.nes` — Alter Ego;
- `.gba` — Anguna;
- `.gen` — Mega Q*bert;
- `.nds` — Bilou: School Rush;
- `.a26` — Halo 2600;
- `.smc` — Classic Kong Complete.

The tracked daedalOS association table supports a broader runtime surface than those demo files. That full surface is enumerated below and should remain visible in the design so implementation does not accidentally hard-code only the bundled examples.

The most important persistence requirement remains unchanged: **browser IndexedDB/OPFS/localStorage must not become authoritative game storage.** Both runtime families have browser-local persistence behaviors. Plasmon should use those only as temporary runtime caches, or disable/override them, while authoritative save bytes live through Plasmon's persistent `FsService` model.

The correct lesson from daedalOS "Snapshots" is not to copy its folder literally. daedalOS stores runtime-specific save artifacts as ordinary files under `/Users/Public/Snapshots`, with a generated screenshot used as the saved file's icon. For js-dos those artifacts are filesystem-change bundles. For EmulatorJS they are emulator save-state bytes. They are **not filesystem snapshots**. daedalOS keys them by source basename, which is convenient but wrong for Plasmon because a rename breaks the relationship. Plasmon should attach saves to stable game `NodeId` instead.

Recommended visible save model:

```text
/Games/Saves/
  Native/
    <friendly game folder>/native.sav
  States/
    <friendly game folder>/autosave.state
  DOS/
    <friendly game folder>/current.changes
```

The visible names are for people; metadata contains the stable source `NodeId`, runtime/system/core identifiers, and compatibility metadata. Native saves, emulator states, and DOS filesystem changes should remain distinct because they have different portability and compatibility properties.

### Temporary/unverified demo-content policy

The licensing audit remains useful evidence, but it is **not** a hackathon-development removal instruction.

Keep the already intended/provided demo assets for the hackathon/development build even where redistribution clearance remains unresolved. Do **not** describe those assets as legally cleared. Mark them as **temporary/unverified demo content** and require a removal/replacement/clearance gate before any distribution that requires clean redistribution rights.

Do not add new copyrighted game content beyond the assets already intended/provided for this project.

The runtime architecture must never depend on a particular game name. Removing or replacing any demo is therefore a filesystem-content change, not a runtime-code change.

No proof code was necessary for this research pass.

---

## 2. Exact daedalOS architecture studied

Primary upstream:

- Repository: https://github.com/DustinBrett/daedalOS
- Commit inspected: https://github.com/DustinBrett/daedalOS/tree/0df82d75e6114727ad035f6fce93842a96682355
- daedalOS license: MIT

Important paths inspected:

| Area | daedalOS path | What it establishes |
| --- | --- | --- |
| js-dos process config | `components/apps/JSDOS/config.ts` | js-dos path prefix, save extension, DOS config files, captured keys |
| js-dos session | `components/apps/JSDOS/useDosCI.ts` | bundle loading, `ci.persist()`, save restore, snapshot creation |
| js-dos UI/runtime | `components/apps/JSDOS/useJSDOS.ts` | lazy runtime setup, player creation, canvas/session lifecycle |
| Emulator config | `components/apps/Emulator/config.ts` | complete tracked extension-to-system mapping |
| Emulator session | `components/apps/Emulator/useEmulator.ts` | ROM Blob URL, core selection, auto-save-state, restore, screenshot |
| Snapshot helper | `hooks/useSnapshots.ts` | `/Users/Public/Snapshots`, ordinary file writes, icon cache |
| Isolated content | `hooks/useIsolatedContentWindow.ts` | same-origin iframe used as isolated runtime/content window |
| Process definitions | `contexts/process/directory.ts` | Program Files runtime assets and runtime process identity |
| File extensions | `components/system/Files/FileEntry/extensions.ts` | `.jsdos`, `.exe`, `.zip`, and EmulatorJS ROM association behavior |
| Constants | `utils/constants.ts` | snapshot path and dynamic save extensions |
| Runtime assets | `public/Program Files/EmulatorJs/*` | vendored EmulatorJS loader/runtime assets |
| Version lock | `package.json`, `yarn.lock` | js-dos packages and exact lock versions |
| User-facing behavior | `README.md` | IndexedDB FS, save-state-on-close, Open With/Properties behavior |
| Git ignore | `.gitignore` | `public/private`, generated indexes, and most `public/Users/Public/**` game/user content are intentionally untracked |
| Credits | `public/CREDITS.md` | upstream references but not a game-content licensing audit |

Exact js-dos package versions in the inspected daedalOS lockfile:

- `emulators` 8.3.9
- `emulators-ui` 0.73.9

The inspected daedalOS `public/Program Files/EmulatorJs/loader.js` contains a loader `VERSION = 23.5`, while the vendored `emulator.min.js` identifies its player implementation as version 2.3.5. In other words, daedalOS' proven EmulatorJS wrapper is useful architectural reference, but its vendored EmulatorJS runtime is old and should not be copied as Plasmon's new dependency.

### Why the public Git tree cannot enumerate every bundled game file

At the inspected commit, `.gitignore` excludes:

- `public/private`;
- generated `public/.index/*` filesystem indexes;
- most of `public/Users/Public/**`.

Therefore the public tracked repository is authoritative for the handler/extension tables, but it is not an exhaustive manifest of the deployed/private game content. The known game catalog supplied for this Plasmon task is used below for the **demo parity set**; the tracked daedalOS code is used for the **full association surface**.

### Exact tracked daedalOS js-dos association surface

`components/system/Files/FileEntry/extensions.ts` routes:

| Extension | daedalOS type | daedalOS candidate process(es) | Plasmon interpretation |
| --- | --- | --- | --- |
| `.jsdos` | JSDOS Bundle | `JSDOS`, `FileExplorer` | js-dos handler is the game runtime candidate |
| `.exe` | Application | `BoxedWine`, `JSDOS` | js-dos is one ordinary candidate; preserve multi-handler semantics if/when `.exe` is exposed |
| `.zip` | Compressed Folder | `FileExplorer`, `BoxedWine`, `JSDOS` | js-dos is one ordinary candidate; do not steal generic ZIP handling |

The known daedalOS DOS demo set for this project uses `.jsdos`, so `.jsdos` is the required DOS game-content parity type. `.exe` and `.zip` are part of the tracked runtime association surface and must not be forgotten if later parity work includes daedalOS content using those forms.

### Exact tracked daedalOS EmulatorJS association surface

`components/apps/Emulator/config.ts` defines these systems/extensions, and `components/system/Files/FileEntry/extensions.ts` registers every extension in that table to the single Emulator process:

| System | daedalOS EmulatorJS system key | Extensions |
| --- | --- | --- |
| Atari 2600 | `atari2600` | `.a26` |
| Atari 5200 | `atari5200` | `.a52` |
| Atari 7800 | `atari7800` | `.a78` |
| Atari Jaguar | `jaguar` | `.j64`, `.jag` |
| Atari Lynx | `lynx` | `.lnx` |
| Neo Geo Pocket | `ngp` | `.ngc`, `.ngp` |
| Nintendo 64 | `n64` | `.n64`, `.v64`, `.z64` |
| Nintendo DS | `nds` | `.nds` |
| Nintendo Entertainment System | `nes` | `.nes` |
| Nintendo Game Boy | `gb` | `.gb` |
| Nintendo Game Boy Advance | `gba` | `.gba` |
| Nintendo Game Boy Color | `gb` | `.gbc` |
| PC Engine | `pce` | `.pce` |
| Sega 32X | `sega32x` | `.32x` |
| Sega Game Gear | `segaGG` | `.gg` |
| Sega Genesis / Mega Drive | `segaMD` | `.gen`, `.md`, `.smd` |
| Sega Master System | `segaMS` | `.sms` |
| Super Nintendo Entertainment System | `snes` | `.sfc`, `.smc` |
| Virtual Boy | `vb` | `.vb`, `.vboy` |
| WonderSwan | `ws` | `.ws`, `.wsc` |

This is the broader **association capability surface**. Plasmon should keep the design data-driven so adding any of these formats is a rule/core-packaging change, not a new application or console-specific program.

### Known daedalOS demo parity set for this project

| Demo content | Extension | Runtime | daedalOS system key | Hackathon parity |
| --- | --- | --- | --- | --- |
| Doom | `.jsdos` | js-dos | DOS | **MUST** |
| Duke Nukem 3D | `.jsdos` | js-dos | DOS | **MUST** |
| Wolfenstein 3-D | `.jsdos` | js-dos | DOS | **MUST** |
| Alter Ego | `.nes` | EmulatorJS | `nes` | **MUST** |
| Anguna | `.gba` | EmulatorJS | `gba` | **MUST** |
| Mega Q*bert | `.gen` | EmulatorJS | `segaMD` | **MUST** |
| Bilou: School Rush | `.nds` | EmulatorJS | `nds` | **MUST** |
| Halo 2600 | `.a26` | EmulatorJS | `atari2600` | **MUST** |
| Classic Kong Complete | `.smc` | EmulatorJS | `snes` | **MUST** |

NDS is therefore **not** a post-MVP format merely because it is harder. If the selected modern EmulatorJS NDS core introduces a concrete BIOS/firmware, touch, threading, or browser blocker, the implementation owner must escalate that blocker to Coordinator A instead of silently dropping `.nds` from parity.

### Existing Plasmon mechanisms inspected

At the Plasmon starting SHA, the association stack already represents the required launch model:

- `apps/plasmon/src/os/associations/registry.ts`
- `apps/plasmon/src/os/associations/openWith.ts`
- `apps/plasmon/src/os/associations/fsDefaults.ts`
- `apps/plasmon/src/os/contracts/associations.ts`
- `apps/plasmon/src/os/contracts/fs.ts`

The contracts already provide:

- stable `FsNode.id` / `NodeId`;
- extension and MIME association rules;
- multiple candidate handlers;
- user defaults;
- local/native OpenService routing kind;
- `OpenService.open(handlerId, OpenTarget)` where `OpenTarget` can carry `nodeId`;
- defaults persisted through the Plasmon filesystem metadata path rather than browser-local application storage.

**Design conclusion:** game launching does not require a new association contract and does not require a `.sys` wrapper. Register normal js-dos and EmulatorJS handlers/rules and let existing Open With/default resolution do its job.

---

## 3. js-dos integration

Primary current upstream references:

- https://js-dos.com/
- https://js-dos.com/emulators.html
- https://js-dos.com/player-api.html
- https://js-dos.com/save-load-game-progress.html
- https://www.npmjs.com/package/emulators
- https://www.npmjs.com/package/js-dos

### What a `.jsdos` file is

A `.jsdos` file is a ZIP-format js-dos bundle containing the DOS program/game files plus js-dos configuration. The bundle contains a `.jsdos` configuration directory, including `dosbox.conf`; js-dos tooling also uses `jsdos.json` metadata. The current `emulators` API can build a bundle and returns the final `.jsdos` bytes as `Uint8Array`.

It should be treated by Plasmon as an ordinary immutable-ish game asset file. The game may be moved or renamed without invalidating its identity because the `FsNode.id`, not its pathname, should be the canonical runtime-state attachment key.

### How daedalOS launches `.jsdos`

The inspected daedalOS flow is:

1. File association resolves `.jsdos` to the JSDOS process.
2. `useDosCI.ts` reads the file bytes from the daedalOS filesystem.
3. For a `.jsdos` input it creates a `Blob`/Object URL for the bundle. Other executable/archive inputs can be dynamically wrapped with config.
4. It looks for a companion save artifact in `/Users/Public/Snapshots` using `<bundle basename>.zip.save`.
5. It launches the bundle through js-dos, optionally passing the saved change bundle.
6. On close/switch it calls `ci.persist()` to obtain changed filesystem data and stores that data plus a screenshot through `createSnapshot()`.

This is a good lifecycle pattern, but Plasmon should not copy the basename-based save key.

### Recommended js-dos version strategy

The current npm `emulators` line is newer than daedalOS' 8.3.9 pin. For the implementation pass:

1. start with exact `emulators@8.3.9` / `emulators-ui@0.73.9` if the objective is lowest-risk parity with daedalOS' wrapper behavior;
2. smoke-test the current supported line before deciding whether to upgrade;
3. pin the selected exact versions and runtime assets; do not use a floating `latest` URL.

The js-dos packages are GPL-2.0. Runtime redistribution must include the required license/source-offer compliance appropriate to how Plasmon ships the compiled assets.

### Browser/runtime requirements

Current js-dos supports browser worker and render-thread execution. The worker backend is the preferred path because it avoids blocking the Plasmon UI thread. Required/likely runtime capabilities for the MVP:

- WebAssembly;
- Web Worker execution;
- same-origin packaged JS/WASM/worker assets under the selected `pathPrefix`;
- canvas rendering, with optional OffscreenCanvas;
- audio, with optional AudioWorklet path;
- Blob/Object URLs if Plasmon bridges `FsService` bytes through URLs;
- user-gesture-safe audio/fullscreen behavior;
- optional mouse capture/pointer-lock behavior;
- no network requirement for local single-player bundles.

IPX/WebRTC networking exists upstream but should be disabled/out of scope for the hackathon. There is no reason for Plasmon to enable cloud save services or multiplayer networking merely to run a local bundle.

### js-dos persistence

Current js-dos save/load is a filesystem-change bundle layered on top of the original game bundle. The current player exposes `fsChanges` hooks (`pull`, `push`, `delete`, `urlToKey`) and documents IndexedDB as the default browser persistence. Current js-dos also describes modern local persistence work involving OPFS.

Plasmon must not leave that default as authoritative.

Recommended adapter:

```text
js-dos session
  original bundle bytes <- FsService(gameNodeId)
  prior changes bytes   <- FsService(saveNodeId)
  runtime worker/canvas
  updated changes bytes -> FsService(saveNodeId)
```

Implementation rules:

- use a key derived from stable game `NodeId`, never the Blob URL or filename;
- configure custom `fsChanges.pull/push/delete` backed by Plasmon persistence, or explicitly call `ci.persist()` and write the resulting bytes through `FsService`;
- disable js-dos cloud persistence;
- ensure default IndexedDB/OPFS data cannot silently win over Plasmon data after a browser/profile restore;
- temporary browser cache is acceptable only if it can be discarded and reconstructed from Plasmon state;
- force a final change flush during clean window/session close before worker teardown;
- a close failure must not report success if the authoritative save write did not complete.

### DOS save semantics

For the MVP, the authoritative Plasmon DOS save artifact should represent the js-dos filesystem changes bundle (`current.changes`). The user's actual in-game save files live inside those changed DOS filesystem bytes.

This is **not** a general emulator machine-state snapshot. DOSBox-X may expose fuller state features, but that is not needed for the initial architecture.

---

## 4. EmulatorJS integration

Primary current upstream:

- Repository: https://github.com/EmulatorJS/EmulatorJS
- Releases: https://github.com/EmulatorJS/EmulatorJS/releases
- Documentation: https://emulatorjs.org/docs/
- Current stable release selected for design: 4.2.3
- Upstream license: GPL-3.0

Current `main` was also inspected for architecture, including:

- `data/src/GameManager.js`
- `data/src/storage.js`
- `data/src/emulator.js`
- `data/src/consts.js`

At research time, upstream also has a 4.3.0 pre-release. The MVP should pin a tested stable release rather than track a pre-release without an explicit reason.

### How daedalOS launches ROMs

The inspected daedalOS flow is:

1. extension maps to an EmulatorJS system/core family;
2. the ROM is read from the daedalOS filesystem;
3. ROM bytes are exposed as a Blob/Object URL (and some inputs may be ZIP-wrapped);
4. daedalOS creates an isolated content window using a same-origin iframe so EmulatorJS' global `EJS_*` configuration and runtime state do not leak into the parent desktop;
5. `EJS_gameUrl`, `EJS_core`, `EJS_pathtodata`, etc. are configured in that isolated window;
6. EmulatorJS loads its core/assets from `/Program Files/EmulatorJs/`;
7. on close, daedalOS triggers EmulatorJS save-state behavior and stores the state bytes plus screenshot in `/Users/Public/Snapshots/<rom basename>.sav`;
8. on next launch that `.sav` is loaded as an emulator state.

The iframe is an isolation container for a game canvas/runtime. It is **not** a second daedalOS kernel. Plasmon may use the same isolation concept if needed for global runtime variables and lifecycle containment.

### Recommended runtime architecture

Use one **EmulatorJS handler registration** and a system/core mapping table. It receives the `nodeId`, determines the system from the already-associated extension, reads bytes via `FsService`, lazy-loads the required core, and starts one isolated runtime session/window.

EmulatorJS is the program/runtime. There is no `Emulator.sys` facade and no native application per console.

### EmulatorJS persistence behavior

Current EmulatorJS has three important persistence channels:

1. **Native game save files** (SRAM/EEPROM/etc.) are located under `/data/saves` in the Emscripten filesystem. `GameManager.mountFileSystems()` mounts that directory using Emscripten `IDBFS` with `autoPersist: true` and performs a sync.
2. **Save states** are serialized emulator/core state and are distinct from native save files. Current `GameManager` exposes state get/load paths.
3. **Settings/controller options** use browser `localStorage` unless disabled. EmulatorJS added `EJS_disableLocalStorage` support before the selected stable line.

Stable 4.2.2 (included in 4.2.3) added `saveDatabaseLoaded` and `saveSaveFiles` events. Current `GameManager.saveSaveFiles()` emits native save bytes through `saveSaveFiles`, and `getSaveFile()` returns the core save file bytes.

This is the key integration opportunity: Plasmon can bridge the runtime's native-save bytes to/from `FsService` instead of treating IDBFS as durable truth.

Recommended startup/close sequence:

```text
OPEN
  read ROM bytes from FsService
  find save metadata by source NodeId
  create isolated runtime session
  wait for saveDatabaseLoaded
  seed native save bytes from Plasmon into runtime save FS
  load optional Plasmon autosave state
  start/focus game

DURING PLAY
  runtime may use IDBFS as a cache
  saveSaveFiles events copy native save bytes -> Plasmon FsService

CLOSE
  request core-native save flush
  copy native save bytes -> Plasmon FsService
  optionally capture autosave state -> Plasmon FsService
  await writes
  terminate core/worker/audio
  revoke Blob URLs / dispose isolated window
```

Settings/controller mapping should eventually use a Plasmon settings/persistence mechanism. For the MVP, disable runtime localStorage where possible and keep only a small explicit default mapping rather than creating a second settings authority.

### NDS parity requirement

`.nds` is part of the required demo parity set because Bilou: School Rush is in the known daedalOS demo catalog.

Modern EmulatorJS exposes multiple NDS core choices (`melonds`, `desmume`, `desmume2015` in current upstream). Core selection should be driven by the compatibility test, not by a desire to remove NDS from scope.

Implementation rule:

1. first choose a pinned EmulatorJS NDS core that launches the intended `.nds` demo in both target browsers without adding new proprietary content;
2. if a chosen core requires BIOS/firmware that is not already an intended/provided project asset, do not silently add new copyrighted firmware;
3. try a compatible no-new-firmware core where practical;
4. if no acceptable core can meet parity, escalate the concrete blocker to Coordinator A before changing scope.

Touch/dual-screen layout is a runtime-window/input concern, not a reason by itself to remove NDS parity.

---

## 5. What daedalOS "snapshots" actually are

This was the critical research question.

**daedalOS snapshots are not filesystem snapshots.** `hooks/useSnapshots.ts` defines `SAVE_PATH` as `/Users/Public/Snapshots` and writes ordinary files there through the normal daedalOS filesystem. The helper optionally caches a screenshot/icon for the saved file.

The folder mixes different runtime payload types:

### js-dos snapshot

- Runtime owner: js-dos/JSDOS process.
- File name: `<source basename>.zip.save`.
- Payload: bytes returned by `CommandInterface.persist()`, i.e. a change bundle containing the DOS filesystem changes relative to the base `.jsdos` bundle.
- Creation: on close/switch daedalOS captures a screenshot and calls `ci.persist()`.
- Restore: on launch it finds the same basename-derived save and passes the change bundle together with the original game bundle.
- Portability: conditional. It depends on the compatible original game bundle/config/runtime. It is not a universal standalone game image.

### EmulatorJS snapshot

- Runtime owner: EmulatorJS process.
- File name: `<source basename>.sav`.
- Payload in daedalOS: serialized emulator **save-state** bytes supplied through `EJS_onSaveState`.
- Creation: daedalOS triggers the EmulatorJS save-state action on close and stores the state plus screenshot.
- Restore: on next launch it loads the saved bytes as emulator state.
- Portability: weak. Emulator save states are generally core/runtime/version-sensitive and should not be treated like portable cartridge SRAM.

### Why Plasmon should not copy the exact model

What is worth preserving:

- users can see/export save artifacts as normal files;
- automatic close-save makes demos resilient;
- saved state can have a screenshot/thumbnail;
- save data remains in the user's filesystem rather than being trapped in a runtime UI.

What should change:

- do not use filename/basename as canonical identity;
- do not mix native SRAM, save states, and DOS change bundles under one ambiguous extension;
- do not let browser IndexedDB become the only backing store;
- attach artifacts to stable source `NodeId` plus runtime compatibility metadata.

`/Games/Saves` is therefore a good Plasmon concept, but it should be structured semantically rather than cloning `/Users/Public/Snapshots`.

---

## 6. Save/persistence model

Recommended visible model:

```text
/Games/Saves/
  Native/
    Anguna/
      native.sav
  States/
    Anguna/
      autosave.state
  DOS/
    Doom/
      current.changes
```

The friendly folder name is presentation only. Each save node/folder should carry metadata equivalent to:

```text
sourceNodeId       stable FsNode.id of source game
runtimeId          e.g. js-dos / emulatorjs
systemId           e.g. gba / nes / nds / dos
coreId             e.g. mgba (when relevant)
runtimeVersion     pinned runtime version used to create state
sourceContentHash  optional integrity/reassociation hint
saveKind           native | state | dos-changes
slot               optional; MVP can use autosave only
```

### Native save versus save state

They must be separate:

- **native save**: cartridge/disk-native persistent data such as SRAM/EEPROM. Usually more portable between emulator implementations and versions.
- **save state**: serialized full emulator/core execution state. Convenient, but compatibility is narrower.
- **DOS changes**: changed files relative to a `.jsdos` base bundle. Different semantics again.

### Rename and move

The source game's stable `NodeId` remains the link. Renaming or moving the source changes only presentation; save attachment remains valid.

### Copy

A copied game file receives a new `NodeId`; by default it should start with independent save state. A future explicit "copy with save data" operation can clone save lineage, but that is outside MVP.

### Delete

Deleting a game should not silently delete save data during the hackathon MVP. Saves become orphaned but remain user-visible/exportable until explicitly removed. A later cleanup UX may detect orphaned `sourceNodeId` references.

### Slots

MVP: one `autosave.state` per game plus one native save channel. Do not build a save-slot manager unless the selected runtime needs it for correctness.

### Export/import

Because saves are ordinary files, export can use normal filesystem export/download. Import UX can come later; the metadata model should make reassociation possible.

### Search

Save files can participate in normal Search, though the FileManager may choose a type/category filter. Do not hide all save truth in runtime-private metadata.

---

## 7. Proposed Plasmon filesystem model

Recommended hackathon layout:

```text
/Games/
  DOS Bundles/
    doom.jsdos
    dn3d.jsdos
    w3d.jsdos
  Roms/
    Alter Ego.nes
    Anguna.gba
    Mega Qbert.gen
    School Rush.nds
    Halo 2600.a26
    Classic Kong.smc
  Saves/
    Native/
    States/
    DOS/

/System/
  Program Files/
    js-dos/
      runtime.json
      LICENSES/
      <curated js-dos runtime assets>
      defaults/
        dosbox.conf
        jsdos.json
    EmulatorJs/
      runtime.json
      LICENSES/
      loader.js
      <curated UI/runtime assets>
      cores/
        <parity cores, packaged/lazy-loaded as required>
```

**There are intentionally no DOS/Emulator `.sys` files in this model.** The game files associate directly with js-dos or EmulatorJS handler registrations. `/System/Program Files` contains the runtimes/assets those handlers load.

The exact demo filenames above are descriptive of the known intended set; runtime logic must not depend on those names.

Game files are ordinary files. Saves are ordinary user files. Runtime/library assets are curated, read-only system resources. Handler registrations are routing/integration metadata, distinct from both `.sys` native applications and Program Files runtime directories.

---

## 8. Associations and handlers

The existing Plasmon `AssociationRegistry` is already sufficient.

Conceptual required rules for the known demo parity set:

```text
handler: js-dos
  extension: .jsdos
  priority: built-in/default runtime candidate

handler: EmulatorJS
  extensions: .nes .gba .gen .nds .a26 .smc
  priority: built-in/default runtime candidate
```

The EmulatorJS handler must use a data-driven mapping from extension to system/core. It must not switch on game names.

The broader daedalOS extension table in section 2 is the compatibility roadmap. Where Plasmon advertises those additional extensions, they still resolve to this same EmulatorJS handler rather than new console programs.

When a user double-clicks a game:

1. FileManager asks normal association resolution.
2. Registry returns ordered candidates.
3. The existing default/user-default logic chooses the handler.
4. `OpenService` invokes the handler with `OpenTarget.nodeId`.
5. The handler reads the source through `FsService` and launches the lazy runtime/core in a game window.

No `switch(gameName)` and no Games-specific launcher table should exist in the Shell.

Open With remains useful: another compatible handler can appear as a candidate using normal association semantics. Games should not be hard-locked to one future implementation forever.

### A handler is not a `.sys` application

This distinction is architectural and frozen for this design:

```text
Association handler
  = routing/execution registration known to AssociationRegistry/OpenService

.sys
  = filesystem representation of a Plasmon-native application identity

/System/Program Files/<runtime>
  = inspectable runtime/library assets
```

These concepts may be related for some Plasmon-native applications, but there is **no one-to-one requirement**.

For games:

```text
.jsdos -> js-dos handler -> js-dos runtime assets
ROM    -> EmulatorJS handler -> EmulatorJS runtime/core assets
```

Do not introduce a `.sys` facade simply to make a runtime look like a Plasmon-native application.

---

## 9. Runtime handler model — no wrapper applications

### js-dos handler

- ordinary AssociationRegistry/OpenService handler registration;
- default runtime candidate for `.jsdos` game bundles;
- owns the integration adapter between `FsService`, js-dos runtime APIs, window lifecycle, and Plasmon save persistence;
- loads runtime/library implementation from `/System/Program Files/js-dos`;
- does **not** correspond to `DOS.sys`.

### EmulatorJS handler

- ordinary AssociationRegistry/OpenService handler registration;
- default runtime candidate for the ROM formats in the parity set;
- maps file type/system to a selected EmulatorJS core;
- owns the integration adapter for ROM bytes, native-save/state persistence, input, and window lifecycle;
- loads runtime/library implementation from `/System/Program Files/EmulatorJs`;
- does **not** correspond to `Emulator.sys`.

### Why not one game-name launcher

A central `Games` program that switches on filenames would bypass the association model and couple product behavior to demo content. It would also make replacement/removal of temporary demo assets harder.

### Why not one handler/application per console

All parity ROMs share the same EmulatorJS host and lifecycle. Separate console handlers/programs would duplicate window/persistence code and create unnecessary product identities. Format/core selection belongs inside the single EmulatorJS handler's data table.

---

## 10. `/System/Program Files` requirements

`/System/Program Files` should be an inspectable **curated runtime projection**, not a mirror of `node_modules`, build caches, or every release artifact.

Each runtime directory should contain:

- `runtime.json`: product name, exact pinned version, upstream, license, selected build/core list, asset hashes if practical;
- `LICENSES/`: upstream license texts and notices;
- only runtime files actually needed by the shipped handler/cores;
- small meaningful defaults/config files.

The visible filesystem can be a projection even if the bundler stores compiled assets elsewhere. The contract needed from Agent 10 is that system runtime resources can be read-only and inspectable without implying they are `.sys` applications or normal mutable user packages.

Saves must never be written under Program Files.

For EmulatorJS, "curated" means package the parity cores needed by the known demo set and lazy-load them. It does **not** mean dropping parity formats merely to reduce effort.

---

## 11. Game identity

Canonical identity for save attachment: **source `FsNode.id` / `NodeId`.**

Secondary identifiers:

- `contentHash`: integrity/duplicate/reassociation hint;
- runtime/system ID: determines interpretation;
- optional curated game metadata ID: useful for known bundled content/artwork, but not required for user files.

Do not use display filename or absolute path as the only identity. This is the main architectural correction over the daedalOS basename save model.

---

## 12. Shortcut behavior

Game shortcuts should use the normal Plasmon shortcut model owned by Agent 10/FileManager:

```text
/Desktop/Doom
  -> target NodeId for /Games/DOS Bundles/doom.jsdos
  -> resolve target
  -> normal association resolution
  -> js-dos handler
```

A shortcut must not encode a second game-launch mechanism.

Game-specific visual requirement: use the target game's provided/approved-for-current-build artwork or generic game icon, then apply Agent 11's ordinary shortcut overlay treatment. Temporary/unverified art follows the same pre-distribution removal/clearance gate as the corresponding demo content.

---

## 13. Properties behavior

Useful ROM properties:

- Type (`NES ROM`, `Game Boy Advance ROM`, etc.);
- System;
- Size;
- Runtime/handler;
- Save data present/size;
- Modified;
- Associated handler.

Useful `.jsdos` properties:

- Type (`DOS Bundle`);
- Size;
- Runtime/handler (`js-dos`);
- Save data present/size;
- Modified;
- Associated handler.

Do not expose internal Emscripten mount paths, worker filenames, core debugging flags, or browser database keys in normal Properties.

---

## 14. Thumbnails and artwork

Research conclusion: daedalOS makes game save-state presentation visually useful by capturing a runtime screenshot and caching it as the snapshot file icon. Plasmon should preserve the idea without depending on live third-party image fetching.

MVP hierarchy:

1. local provided/curated artwork available for the current build;
2. last locally generated game screenshot where available;
3. platform-specific generic ROM icon if Agent 11 wants variants;
4. generic ROM/game icon;
5. generic DOS bundle icon for `.jsdos`.

For save files:

- save state: the captured frame is appropriate because it represents a moment in execution;
- native save: prefer the source game's artwork/icon plus a save indicator, not an arbitrary execution screenshot;
- DOS changes: source game artwork/icon plus a DOS-save indicator.

Artwork must be packaged/local or generated locally. FileManager rendering must not depend on fetching game art from a third-party website.

Temporary/unverified provided artwork may remain in the hackathon/development build with the same distribution gate as its game. It must not be represented as cleared merely because it is present.

Agent 11 owns final icon language, border/size treatment, and shortcut overlay.

---

## 15. Window, fullscreen, and input behavior

Games need tighter lifecycle rules than document viewers, but should still behave as normal Plasmon windows.

### Window states

- normal and maximized: canvas resizes to available client area;
- minimize: emulator remains owned by the same runtime session; audio should pause/mute if feasible and input must release;
- restore/focus: runtime receives focus again without reinitializing the game;
- close: save barrier first, then runtime teardown.

### Fullscreen

Two concepts may exist:

- maximized Plasmon window;
- browser-level Fullscreen API requested by the runtime integration from a user gesture.

Browser fullscreen must be optional. Escape must always provide a path out of browser fullscreen/pointer lock and back to Plasmon.

### Keyboard

- capture game keys only while the game content is foreground/focused;
- do not attach permanent global listeners that steal Shell shortcuts;
- daedalOS' JSDOS captured function/Alt/context keys are a useful warning that game-specific capture must be scoped to the active game;
- on blur/minimize/close, release capture.

### Pointer/mouse

- pointer lock only after an explicit game click/user gesture where required;
- release on Escape, blur, minimize, or close;
- mouse capture is a runtime option, not a global OS mode.

### Touch / NDS

For `.nds`, the game window must expose the dual-screen/touch interaction required by the selected EmulatorJS core. This can be a runtime-local layout/overlay; it does not require a new Plasmon windowing primitive.

If the selected NDS core cannot receive usable pointer/touch input in Firefox and Chromium/Edge under the packaged environment, record and escalate that concrete parity blocker.

### Controllers

Gamepad API input should be treated as belonging to the foreground game session. Controller remapping UI is post-MVP.

### Cleanup

On close dispose/revoke:

- worker(s);
- Blob/Object URLs;
- iframe/content window if used;
- audio nodes/contexts owned by the runtime;
- pointer lock/fullscreen;
- event listeners;
- temporary runtime mounts/caches.

---

## 16. Firefox and Chromium/Edge constraints

Acceptance target: current desktop Firefox and Chromium/Edge in the packaged Neutron/Plasmon environment.

| Capability | js-dos | EmulatorJS parity cores | MVP requirement |
| --- | --- | --- | --- |
| WebAssembly | Yes | Yes | MUST |
| Worker | Preferred/normal backend | runtime/core dependent | MUST where selected runtime/core requires it |
| SharedArrayBuffer / threaded WASM | avoid unless selected build requires it | core dependent; verify parity cores individually | Escalate if a parity core requires unavailable cross-origin isolation |
| Canvas/WebGL | Canvas; optional OffscreenCanvas | Canvas/WebGL depending core | MUST |
| AudioContext/AudioWorklet | audio path | audio path | user-gesture/autoplay test |
| Fullscreen API | supported option | supported | HIGH |
| Pointer Lock | optional mouse capture | core/system dependent | HIGH for mouse games |
| Touch/pointer input | optional DOS mouse/touch mapping | required for NDS parity usability | MUST for NDS parity |
| Gamepad API | UI/runtime support | built in | HIGH |
| IndexedDB | upstream default save/cache | IDBFS/native save cache | available but non-authoritative |
| OPFS | current js-dos local-persistence work | not primary | non-authoritative |
| localStorage | avoid for authority | runtime settings unless disabled | disable/adapt |
| Blob/Object URL | convenient FS byte bridge | convenient ROM bridge | CSP must permit if used |

CSP/package requirements should be tested rather than guessed. Likely allowances include self-hosted WASM/worker/script assets and `blob:` for Object URLs/worker paths if the selected integration uses them. Do not open broad remote script origins; all runtime/core assets should be packaged locally for the MVP.

The known parity systems are:

- NES;
- Game Boy Advance;
- Sega Genesis/Mega Drive;
- Nintendo DS;
- Atari 2600;
- SNES;
- DOS through js-dos.

None may be classified LATER solely for convenience. A format can leave the parity gate only by an explicit Coordinator A scope decision after a concrete blocker is documented.

---

## 17. Persistence integration with Plasmon

### Rule

**The authoritative byte representation of user progress must be reachable through Plasmon persistent services.** Clearing browser-site storage must not be equivalent to deleting the user's game progress.

### js-dos

Preferred order:

1. read `current.changes` by stable source NodeId;
2. seed the runtime through custom `fsChanges` or initial bundle layering;
3. on save/close receive current change bytes;
4. write through `FsService`;
5. only then consider close complete.

### EmulatorJS native saves

1. wait until EmulatorJS' save filesystem is mounted;
2. write Plasmon's native save bytes into the runtime expected save path;
3. instruct/allow core to refresh native save files;
4. on `saveSaveFiles` and clean close, copy returned native save bytes into `/Games/Saves/Native/...` through `FsService`.

### EmulatorJS states

Use serialized state APIs separately. Store `autosave.state` with runtime/core/version metadata. If a later runtime cannot safely load an old state, the user should still retain the file and native save rather than losing progress.

### IDBFS/IndexedDB

It may remain a performance/session cache if eliminating it would require a deep fork, but it must be seeded from Plasmon and flushed to Plasmon. A stale browser cache must never override newer Plasmon save metadata silently.

### Settings

Disable EmulatorJS localStorage where practical (`EJS_disableLocalStorage`) and keep MVP settings fixed/minimal. A later settings bridge belongs to normal Plasmon persistence, not a game-specific browser database.

---

## 18. Performance and package-size analysis

Do not make the initial Plasmon bundle pay for every emulator core, but do package/lazy-deliver every core required for the known daedalOS demo parity set.

### Runtime table

| Runtime | Purpose | Size/cost finding | Browser requirements | Persistence default/behavior | Parity? |
| --- | --- | --- | --- | --- | --- |
| js-dos `emulators` + UI | DOS `.jsdos` | JS/UI + WASM/worker assets; exact shipped size must be measured from pinned build | WASM, Worker preferred, canvas/audio, Blob if used | IndexedDB by default; current custom `fsChanges`; current local persistence also references OPFS | MUST |
| EmulatorJS host | Multi-console ROM host | small host compared with all-core release; package host + parity cores | WASM, canvas/WebGL, audio, Gamepad, Blob if used | IDBFS for native saves; localStorage settings | MUST |
| EmulatorJS all-core release | every supported core | release archive is hundreds of MB; unacceptable as unconditional startup payload | varies by core | varies | NO |
| Parity EJS cores | NES/GBA/Genesis/NDS/Atari2600/SNES | lazy package/load the tested core set; exact release sizes must be measured | core dependent | shares EJS save bridge | MUST |
| Additional daedalOS association cores | broader table in section 2 | add only when the corresponding content/format is actually exposed | core dependent | shares EJS save bridge | compatibility roadmap |

The stable EmulatorJS all-core prebuilt release is hundreds of MB. That is evidence for a curated/lazy-core strategy, not a reason to reject required parity systems.

### Packaging strategy

- initial desktop load: no game runtime/core payload executed or fetched;
- opening first `.jsdos`: lazy-load pinned js-dos assets;
- opening first ROM: lazy-load EmulatorJS host plus only the mapped core;
- every core needed by the known demo parity set must be packaged/available to lazy-load before the parity gate passes;
- cache immutable runtime assets normally after first load;
- package/hash runtime assets locally rather than depend on CDN availability;
- keep game/ROM bytes in the filesystem and read only when launched;
- do not add new proprietary BIOS/firmware merely to satisfy a core choice; choose another compatible core or escalate if parity is otherwise blocked.

Exact compressed/brotli sizes and memory peaks are an implementation gate. The implementing agent should record bundle analyzer output for the pinned assets and one representative game per parity runtime/system.

---

## 19. Game/ROM licensing audit and temporary-content gate

This table is a technical redistribution-risk audit, not legal advice and **not a statement that any demo asset is legally cleared for public redistribution**.

Coordinator A product direction for the hackathon/development build is to retain the already intended/provided demo assets while clearly marking unresolved rights. The architecture must make them removable/replacable without changing runtime code.

### Requested ROMs

| Game | Format | Evidence found | Rights confidence for clean redistribution | Hackathon/development treatment |
| --- | --- | --- | --- | --- |
| Alter Ego | `.nes` | Shiru/Retrosouls NES homebrew; NESdev author discussion | unresolved; no clean formal redistribution license established in this pass | **KEEP TEMPORARILY / UNVERIFIED** |
| Anguna v0.95 | `.gba` | Nathan Tolbert/Gauauu readme contains explicit binary-distribution language if its text accompanies the binary | strongest evidence in this set, but still subject to project distribution review | **KEEP TEMPORARILY / UNVERIFIED FOR PROJECT GATE** |
| Mega Q*bert | `.gen` | free downloadable homebrew/fan adaptation | no clean redistribution license established; derivative-IP concern | **KEEP TEMPORARILY / UNVERIFIED** |
| Bilou: School Rush | `.nds` | free NDS homebrew; engine described as open source | no explicit binary redistribution grant established in this pass | **KEEP TEMPORARILY / UNVERIFIED** |
| Halo 2600 | `.a26` | Ed Fries / Smithsonian evidence | copyrighted/derivative work; no general Plasmon redistribution grant established | **KEEP TEMPORARILY / UNVERIFIED** |
| Classic Kong Complete | `.smc` | homebrew/community `(PD)` tagging | `(PD)` is not reliable evidence of legal public-domain status; derivative-IP concern | **KEEP TEMPORARILY / UNVERIFIED** |

Anguna evidence:

- https://github.com/retrobrews/gba-games/blob/add86969f1a7a3b9534822a9a015d05ed20a0dcf/anguna.txt

The readme contains favorable redistribution language for the binary if that text remains available with it. Do not convert that research observation into a blanket product claim that the full packaged asset set is legally cleared.

Alter Ego evidence:

- https://forums.nesdev.org/viewtopic.php?t=10404

Mega Q*bert evidence:

- https://jaklub.itch.io/mega-qbert

School Rush evidence:

- https://pypebros.itch.io/bilou-school-rush

Halo 2600 evidence:

- https://americanart.si.edu/artwork/halo-2600-82224

Classic Kong caution:

- https://www.nesdev.org/wiki/Public_domain

### Requested DOS bundles

| Game | Format | Evidence/status | Rights confidence for repackaged `.jsdos` | Hackathon/development treatment |
| --- | --- | --- | --- | --- |
| Doom | `.jsdos` | historical shareware data; engine source license is separate from game data | exact `.jsdos` repackaging permission not established | **KEEP TEMPORARILY / UNVERIFIED** |
| Duke Nukem 3D | `.jsdos` | historical shareware episode; source/data rights separate | exact `.jsdos` repackaging permission not established | **KEEP TEMPORARILY / UNVERIFIED** |
| Wolfenstein 3-D | `.jsdos` | historical shareware Episode 1 | exact `.jsdos` repackaging permission not established | **KEEP TEMPORARILY / UNVERIFIED** |

Important Doom references:

- https://github.com/id-Software/DOOM
- https://sources.debian.org/src/doom-wad-shareware/1.9.fixed-2/debian/copyright/

The GPL source release explicitly says real Doom data is still required; the engine license is not a WAD/data license.

Duke source/data distinction:

- https://github.com/videogamepreservation/dukenukem3d

### Why daedalOS chose these games

The inspected public daedalOS source and credits do **not** document a formal rationale for this exact catalog. The selection appears to be a system-diverse set weighted toward homebrew/free-download/shareware content, but that is an inference, not source-backed licensing policy. Plasmon must not assume daedalOS inclusion equals redistribution permission.

### Required pre-distribution gate

Before any release/distribution mode that requires clean redistribution rights:

1. inventory every bundled game binary, DOS bundle, artwork file, firmware/BIOS file, and accompanying notice;
2. classify each as cleared, project-owned, or unresolved;
3. remove or replace unresolved assets before that distribution;
4. keep handler/core/association behavior unchanged when content is removed;
5. do not add substitute copyrighted game content without a separate rights review.

For hackathon/development, the already intended/provided assets may remain. This design correction itself adds none.

---

## 20. daedalOS reuse-vs-rewrite analysis

| Piece | Classification | Recommendation |
| --- | --- | --- |
| Extension -> process association idea | **COPY/ADAPT** | map extensions to ordinary Plasmon handlers through existing AssociationRegistry |
| One Emulator runtime handler for many systems | **COPY/ADAPT** | keep one EmulatorJS handler and core map |
| Read game bytes from virtual FS then Blob URL | **COPY/ADAPT** | use `FsService`; prefer direct byte API if stable, Blob only as adapter |
| Lazy runtime dependencies | **COPY/ADAPT** | critical for package cost |
| Save-on-close lifecycle | **COPY/ADAPT** | preserve, but await Plasmon persistence barrier |
| Screenshot-backed save-state icon | **COPY/ADAPT** | good UX; integrate with Agent 11 thumbnail rules |
| Same-origin iframe content isolation for EJS globals | **CONCEPT ONLY** | useful if needed; implement a small Plasmon-owned isolation wrapper |
| `/Users/Public/Snapshots` user-visible concept | **CONCEPT ONLY** | replace with typed `/Games/Saves` structure |
| Emscripten filesystem exposure in FileManager | **CONCEPT ONLY / POST-MVP** | interesting inspectability, not required to prove launch/save |
| daedalOS basename save keys | **DO NOT USE** | breaks on rename and collides |
| daedalOS old vendored EmulatorJS runtime | **DO NOT USE** | pin a tested supported EmulatorJS release instead |
| browser IndexedDB as durable game truth | **DO NOT USE** | Plasmon `FsService` must be authoritative |
| hard-coded game catalog/switch statements | **DO NOT USE** | associations drive launch |
| all EmulatorJS cores as unconditional startup payload | **DO NOT USE** | curated lazy core set; include all parity cores, not every upstream core |
| `.sys` facade for js-dos/EmulatorJS | **DO NOT USE** | handler registrations route directly to existing runtimes |
| assuming daedalOS inclusion means legal clearance | **DO NOT USE** | keep existing demos temporary/unverified; enforce pre-distribution gate |

If any daedalOS wrapper code is copied substantially, preserve its MIT attribution. js-dos and EmulatorJS runtime licenses remain separate obligations.

---

## 21. Bounded hackathon parity proposal

Two runtimes are justified because they prove that Plasmon's filesystem/association abstraction is not specific to one emulator format.

### MUST demo flow A: DOS

```text
/Games/DOS Bundles/<existing demo>.jsdos
  -> AssociationRegistry
  -> js-dos handler
  -> lazy /System/Program Files/js-dos runtime
  -> play/change DOS files
  -> close
  -> /Games/Saves/DOS/.../current.changes
  -> reopen and restore
```

The intended Doom, Duke Nukem 3D, and Wolfenstein 3-D bundles may remain as temporary/unverified hackathon/development examples. Runtime code must treat them as generic `.jsdos` files.

### MUST demo flow B: EmulatorJS parity

Every known daedalOS EmulatorJS demo format must launch through the single EmulatorJS handler:

```text
Alter Ego.nes         -> EmulatorJS -> NES core
Anguna.gba            -> EmulatorJS -> GBA core
Mega Qbert.gen        -> EmulatorJS -> Genesis/Mega Drive core
School Rush.nds       -> EmulatorJS -> NDS core
Halo 2600.a26         -> EmulatorJS -> Atari 2600 core
Classic Kong.smc      -> EmulatorJS -> SNES core
```

Each flow must use normal `FsService` reads, normal associations, lazy core assets, and the same generic save bridge.

### Hackathon parity formats

Hard gate: **the known daedalOS demo content types are MUST.**

- `.jsdos`;
- `.nes`;
- `.gba`;
- `.gen`;
- `.nds`;
- `.a26`;
- `.smc`.

Implementation may stage these in an efficient order, but the final parity gate is not complete until all seven content types launch or a concrete blocker has been escalated and explicitly dispositioned by Coordinator A.

The broader association surface in section 2 remains a compatibility target/data table, but the seven content types above are the required known-demo parity subset.

### Convincing demo acceptance

- double-click launches every known parity content type via normal associations;
- Open With shows normal candidates/default behavior;
- no game launch depends on a `.sys` wrapper;
- a desktop shortcut opens the same target through normal resolution;
- Properties shows system/runtime/save information;
- runtime/core is lazy-loaded;
- save progress survives close/reopen from Plasmon persistence where the game/core has persistent data/state support;
- renaming/moving the source file does not lose its save because `NodeId` is stable;
- current Firefox and Edge/Chromium pass launch/audio/input/close/reopen smoke tests for each parity system;
- NDS touch/dual-screen interaction is usable or a concrete blocker is escalated;
- removing a temporary demo file does not require changing handler/runtime code.

---

## 22. Post-MVP features

- EmulatorJS systems/cores from the broader daedalOS association table that are not represented in the known current demo set;
- multiple save-state slots;
- save import/reassociation UX;
- controller remapping UI;
- generated screenshot gallery;
- per-game launch options;
- Emscripten runtime filesystem inspection/mounting;
- optional shaders;
- rewind;
- netplay/multiplayer;
- game catalog/discovery/store UX;
- Atom-like shareable game-session/save resources after the Atom design is complete.

**NDS itself is not listed here** because it is part of the hackathon parity requirement.

No Atom/MTN/Sharing dependency is required for the hackathon game subsystem.

---

## 23. Exact dependencies on Agent 10 and Agent 11

### Agent 10 — filesystem semantics

Need final decisions/guarantees for:

1. stable `NodeId` preservation across rename/move in the actual implementation;
2. shortcut target representation/resolution so a shortcut reaches the target node before normal association resolution;
3. read-only/system semantics for `/System/Program Files`;
4. hidden metadata conventions, especially whether typed save metadata belongs directly on `FsNode.metadata`;
5. whether `/Games/Saves` is seeded or created on first use;
6. search/index behavior for save files;
7. copy semantics for NodeId so copied games naturally receive a new save identity;
8. clear confirmation that handler registration can exist without a `.sys` filesystem application, preserving the Coordinator A distinction rather than coupling the two concepts later.

Agent 12 does **not** require Agent 10 to invent DOS/Emulator `.sys` nodes.

### Agent 11 — visual system

Need assets/rules for:

1. js-dos handler/runtime icon identity where a handler icon is surfaced;
2. EmulatorJS handler/runtime icon identity where a handler icon is surfaced;
3. generic `.jsdos` bundle icon;
4. generic ROM icon, optionally with small platform variants if consistent with the new visual system;
5. native-save icon/presentation;
6. save-state icon/presentation;
7. shortcut overlay composition over game art/icon;
8. thumbnail dimensions/cropping/fallback behavior;
9. whether platform/system badges are allowed without making icons visually noisy.

These are handler/runtime/file visuals, **not requests for DOS/Emulator `.sys` application icons.**

Agent 12 supplies the semantic states; Agent 11 owns final art and icon language.

---

## 24. Work later needed from runtime, Shell, and FileManager owners

### Game runtime integration owner

- implement the js-dos handler adapter/window integration;
- implement the single EmulatorJS handler adapter/window integration;
- implement data-driven extension -> system/core selection for all parity formats;
- implement lazy runtime/core asset loading;
- implement `FsService` byte bridge;
- implement js-dos change persistence adapter;
- implement EmulatorJS native-save and state bridge;
- implement worker/iframe/objectURL/audio teardown;
- implement focused input/pointer/fullscreen handling;
- implement NDS dual-screen/touch behavior required by the selected core.

Do not implement `.sys` wrapper shells around either runtime.

### Shell/window owner

- ensure focused game window receives input without stealing global shell behavior;
- expose safe maximize/minimize/restore behavior to runtime canvas;
- provide close lifecycle that can await a short persistence barrier rather than destroying the runtime before save flush;
- guarantee Escape can recover from pointer lock/browser fullscreen according to browser APIs.

No WindowManager redesign is requested.

### FileManager/Open With owner

- register js-dos and EmulatorJS handler definitions/rules at the integration composition point;
- preserve normal Open With/default semantics;
- surface game-specific Properties data using provider/metadata extension points;
- render provided/generated thumbnails through the normal icon/thumbnail path;
- make shortcuts visually resolve to target game artwork plus normal overlay.

### Build/package owner

- package exact pinned runtime assets;
- include every EmulatorJS core needed by the known demo parity set while still lazy-loading them;
- exclude unrelated unused cores from the unconditional/startup payload;
- include required GPL notices/source compliance artifacts;
- collect exact compressed sizes and bundle analyzer output;
- configure CSP for local WASM/worker/Blob use only as needed;
- do not introduce new proprietary BIOS/firmware without explicit project direction.

---

## 25. Implementation sequence

1. Register js-dos and EmulatorJS handlers with existing `AssociationRegistry`; do not create `.sys` wrappers.
2. Implement js-dos launch against an existing intended `.jsdos` demo and make browser-local persistence non-authoritative.
3. Implement one generic EmulatorJS handler plus data-driven extension/system mapping.
4. Bring up the easiest EmulatorJS parity ROM first to validate the generic loader/save bridge.
5. Add the remaining parity mappings/cores in a staged order, but keep all `.nes`, `.gba`, `.gen`, `.nds`, `.a26`, `.smc` targets in MUST scope.
6. For `.nds`, test a pinned compatible core that does not require adding new proprietary firmware if possible; escalate a concrete blocker rather than demoting NDS silently.
7. Add typed `/Games/Saves` creation/metadata using Agent 10's final FS semantics.
8. Add native-save correctness, then close autosave state where supported.
9. Add Properties and shortcut behavior through existing FileManager surfaces.
10. Add Agent 11 icons/thumbnail hierarchy.
11. Run Firefox + Edge/Chromium packaged-environment acceptance for all seven parity content types.
12. Record actual runtime/core compressed sizes and memory observations.
13. Keep the broader daedalOS association surface data-driven for later content without packaging every upstream core at startup.
14. Before a clean-rights distribution, execute the temporary-content removal/replacement/clearance gate without changing runtime code.

---

## 26. Priority and size estimates

Definitions requested for this project:

- Priority: `MUST`, `HIGH`, `NORMAL`, `LATER`
- Size: `Tiny`, `Small`, `Medium`, `Big`, `Really Big`

| Work | Priority | Size | Owner note |
| --- | --- | --- | --- |
| Register js-dos + EmulatorJS handlers using existing associations, with no `.sys` wrappers | MUST | Small | integration |
| `.jsdos` runtime launch from `FsService` | MUST | Medium | runtime integration |
| js-dos Plasmon-authoritative changes persistence | MUST | Medium | runtime/persistence |
| Generic EmulatorJS launch from `FsService` | MUST | Medium | runtime integration |
| EmulatorJS native-save bridge | MUST | Big | runtime/persistence |
| EmulatorJS autosave-state bridge | MUST | Medium | runtime/persistence |
| `.nes` parity | MUST | Small after generic loader | EmulatorJS |
| `.gba` parity | MUST | Small after generic loader | EmulatorJS |
| `.gen` parity | MUST | Small after generic loader | EmulatorJS |
| `.a26` parity | MUST | Small after generic loader | EmulatorJS |
| `.smc` parity | MUST | Small after generic loader | EmulatorJS |
| `.nds` parity including touch/core/firmware decision | MUST | Big | EmulatorJS; escalate blocker, do not silently defer |
| `/Games/Saves` typed metadata/layout | MUST | Medium | coordinate Agent 10 |
| Runtime manifests/license notices | MUST | Small | build/package |
| Lazy runtime/parity-core packaging | MUST | Medium | build/package |
| Keep intended demo content data-only/generic | MUST | Tiny | no game-name dispatcher |
| Temporary/unverified content pre-distribution gate | MUST before clean-rights distribution | Medium | packaging/release |
| Current Firefox + Edge/Chromium parity smoke matrix | MUST | Big | integration QA across all parity systems |
| Properties fields | HIGH | Small | FileManager |
| Game/save thumbnails | HIGH | Medium | runtime + Agent 11 |
| Shortcut target game icon integration | HIGH | Small | FileManager + Agent 11 |
| Additional daedalOS association formats beyond current demo set | NORMAL | Medium cumulative | same EmulatorJS handler |
| Save import/reassociation UI | LATER | Medium | FileManager |
| Multi-slot save-state UI | LATER | Medium | runtime |
| All upstream EmulatorJS cores/content catalog | LATER | Really Big | not required for current daedalOS demo parity |
| Netplay/store/achievements | LATER | Really Big | explicitly out of scope |

---

## 27. Unresolved decisions

1. Exact js-dos pin for implementation: reproduce daedalOS-proven 8.3.9 first versus moving to a newer supported line after a measured smoke test.
2. Whether `/System/Program Files` is physically materialized or a virtual read-only projection.
3. Exact save extensions. Recommendation is `.changes` for DOS delta, native/core-appropriate save extension for native bytes, and `.state` for emulator state; avoid globally hijacking generic `.sav` for all concepts.
4. Exact modern EmulatorJS core selection for each parity system, especially `.nds`.
5. For NDS, whether the chosen core can satisfy School Rush parity without adding new proprietary BIOS/firmware. If not, escalate the specific blocker to Coordinator A.
6. Whether every clean close creates `autosave.state` or only native save data is automatic. Recommendation: native save always; autosave state on clean close where core supports it, clearly labeled as state.
7. Exact EmulatorJS method used to ensure IDBFS can never beat newer Plasmon bytes. Implementation should include a targeted smoke test of startup seed -> play -> save -> clear browser storage -> restore from Plasmon.
8. Exact CSP rules in the packaged Neutron context after runtime assets are pinned.
9. Which temporary/unverified game/art assets survive the separate pre-distribution rights gate. This must not affect handler/runtime architecture.

The question of `DOS.sys` versus `Emulator.sys` is **not unresolved**: neither wrapper should exist.

---

## Required format table

### Known daedalOS demo parity — all MUST

| Extension | Demonstrated system/content | Handler/runtime | Save support | BIOS/firmware concern | Hackathon parity | Browser note |
| --- | --- | --- | --- | --- | --- | --- |
| `.jsdos` | DOS | js-dos handler / js-dos | filesystem-change bundle; in-game saves inside changes | No normal BIOS requirement | **MUST** | Worker/WASM/audio/pointer behavior must pass packaged-browser smoke |
| `.nes` | NES/Famicom cartridge | EmulatorJS handler / `nes` system | native save where cartridge supports it + state | No for ordinary NES carts; FDS is separate | **MUST** | expected low-risk parity path |
| `.gba` | Game Boy Advance | EmulatorJS handler / `gba` system | native save + state | GBA BIOS is optional for common emulation paths | **MUST** | expected low-risk parity path |
| `.gen` | Sega Mega Drive/Genesis | EmulatorJS handler / `segaMD` system | SRAM where game supports it + state | verify selected core's BIOS/TMSS behavior without adding new firmware | **MUST** | test Mega Q*bert directly |
| `.a26` | Atari 2600 | EmulatorJS handler / `atari2600` system | state; native persistence only where cartridge/peripheral supports it | No normal console BIOS | **MUST** | expected low-risk parity path |
| `.smc` | SNES/Super Famicom | EmulatorJS handler / `snes` system | SRAM + state | no ordinary-cart BIOS | **MUST** | test Classic Kong directly |
| `.nds` | Nintendo DS | EmulatorJS handler / `nds` system | native save + state | core-dependent; melonDS may require BIOS/firmware, other available cores may differ | **MUST** | dual-screen/touch + core/firmware path must be tested; escalate blocker rather than defer |

### Broader tracked daedalOS EmulatorJS association surface

These extensions all map to the same daedalOS Emulator process and therefore should remain expressible through one Plasmon EmulatorJS handler if/when exposed:

```text
.32x
.a26 .a52 .a78
.gb .gba .gbc
.gen .md .smd
.gg .sms
.j64 .jag
.lnx
.n64 .v64 .z64
.nds .nes
.ngc .ngp
.pce
.sfc .smc
.vb .vboy
.ws .wsc
```

Tracked js-dos candidate surface:

```text
.jsdos
.exe   (js-dos is one candidate alongside BoxedWine in daedalOS)
.zip   (js-dos is one candidate alongside archive/FileExplorer and BoxedWine behavior in daedalOS)
```

Do not collapse generic `.exe` or `.zip` handling merely to imitate js-dos; preserve normal multi-handler/Open With semantics.

System documentation:

- NES: https://emulatorjs.org/docs/systems/nes-famicom/
- GBA: https://emulatorjs.org/docs/systems/nintendo-game-boy-advance/
- NDS: https://emulatorjs.org/docs/systems/nintendo-ds/
- Genesis: https://emulatorjs.org/docs/systems/sega-mega-drive/
- SNES: https://emulatorjs.org/docs/systems/snes/

---

## Explicit answers to the 22 required questions

### 1. What exactly is a `.jsdos` file?

A ZIP-format js-dos bundle containing DOS program/game files plus js-dos configuration under `.jsdos/` such as `dosbox.conf` and js-dos metadata/config.

### 2. How does daedalOS launch it?

It reads the filesystem bytes, makes a Blob/Object URL, restores an optional companion `.zip.save` changes bundle from `/Users/Public/Snapshots`, runs it through js-dos, and persists changes on close.

### 3. What exactly are daedalOS game snapshots?

Ordinary files in `/Users/Public/Snapshots` containing runtime save artifacts. JSDOS snapshots are filesystem-change bundles; EmulatorJS snapshots are serialized emulator save states. The folder is not a filesystem versioning/snapshot system.

### 4. How are DOS saves persisted?

In daedalOS, `ci.persist()` emits a js-dos changes bundle stored as `<bundle basename>.zip.save`. In Plasmon, store equivalent changes bytes through `FsService`, keyed by source `NodeId`.

### 5. How does EmulatorJS persist native saves/save states?

Current EmulatorJS mounts `/data/saves` with Emscripten IDBFS for native core saves and exposes events/APIs to obtain native save bytes. Save states are a separate serialized state path. daedalOS currently focuses on the state path for its auto-snapshot file.

### 6. Which browser storage mechanisms do the runtimes use?

js-dos defaults to browser local persistence including IndexedDB, with current custom `fsChanges` hooks and newer OPFS-related local persistence. EmulatorJS uses IDBFS/IndexedDB for `/data/saves` and localStorage for settings unless disabled.

### 7. How should Plasmon replace/adapt that persistence?

Make `FsService` authoritative. Seed runtime caches from Plasmon on launch, flush bytes to Plasmon on save/close, disable cloud/local settings authority where possible, and ensure clearing browser storage does not destroy user progress.

### 8. Which ROM systems should the hackathon MVP support?

Every system represented in the known daedalOS EmulatorJS demo set: NES, GBA, Genesis/Mega Drive, Nintendo DS, Atari 2600, and SNES. `.jsdos` DOS content is also MUST. NDS may not be demoted merely for convenience; a concrete blocker must be escalated.

### 9. Which requested sample games are legally redistributable?

This design does **not** claim that the packaged demo set is legally cleared. Anguna has the strongest explicit redistribution evidence found, while several other demos remain unresolved. All intended/provided demo assets are treated as temporary/unverified for the hackathon/development build until the separate pre-distribution rights gate.

### 10. Which require replacements?

None are required to be replaced merely to continue the hackathon/development build under the current product direction. Any asset that remains unresolved at a clean-rights distribution gate must then be removed, replaced, or separately cleared. No new copyrighted substitute content should be added casually.

### 11. Should there be one `Games.sys`, separate `DOS.sys`/`Emulator.sys`, or something else?

**None of those wrappers.** Register one js-dos handler and one EmulatorJS handler. They route directly to runtimes/assets under `/System/Program Files`. A handler does not require a `.sys`; `.sys` remains for Plasmon-native application identity.

### 12. What belongs in `/System/Program Files`?

Pinned, read-only, curated runtime assets; version/upstream/license manifest; license notices; parity EmulatorJS cores; meaningful defaults. Not `node_modules`/build cache, not saves, and not fake `.sys` facade applications.

### 13. How should normal Open With/association resolution launch games?

Register normal js-dos/EmulatorJS handler definitions/rules with existing AssociationRegistry. `OpenService` receives the chosen handler plus `OpenTarget.nodeId`; the handler reads the game from `FsService` and invokes the corresponding runtime.

### 14. How should game shortcuts work?

A shortcut resolves to the target game node and then follows the same normal association path. No shortcut-specific game launcher.

### 15. What stable identity links games to save data?

Primary: source `NodeId`. Secondary: content hash and runtime/system/core metadata.

### 16. What happens when the game file is renamed or moved?

Nothing to the save link because NodeId remains the key. Friendly save presentation can update lazily.

### 17. How should saves appear in `/Games/Saves`?

As ordinary user-visible/exportable files grouped by semantic kind (`Native`, `States`, `DOS`) with source/runtime metadata.

### 18. Should save states and native saves be separate?

Yes. Native saves are usually more portable; states are core/version-sensitive. DOS changes are a third separate kind.

### 19. How are game thumbnails generated/selected?

Provided/local current-build artwork first where available, then locally generated last-session screenshot, then platform/generic game icon. Temporary/unverified provided art follows the same distribution gate as its game. Save-state screenshots can be thumbnails; no live web art dependency.

### 20. What is the minimum convincing hackathon implementation?

Association-driven launch and persistence for the complete known daedalOS js-dos/EmulatorJS demo-format set: `.jsdos`, `.nes`, `.gba`, `.gen`, `.nds`, `.a26`, `.smc`; one js-dos handler; one EmulatorJS handler; lazy runtimes/cores; normal shortcut/Open With/Properties; Plasmon-authoritative save/restore; Firefox and Edge/Chromium parity tests; and no `.sys` wrappers.

### 21. What can we directly adapt from daedalOS?

Association-driven launch concept, one Emulator runtime handler for many systems, FS-byte-to-runtime bridge, lazy dependencies, save-on-close lifecycle, generated screenshots, and optional iframe isolation pattern.

### 22. What should we deliberately not copy?

Basename save keys, old vendored EmulatorJS runtime, browser-local persistence authority, hard-coded game catalogs, all-core unconditional payloads, ambiguous mixed snapshot formats, `.sys` facades around third-party runtimes, or the assumption that daedalOS inclusion proves redistribution clearance.

---

## Source index

### daedalOS exact source

- https://github.com/DustinBrett/daedalOS/tree/0df82d75e6114727ad035f6fce93842a96682355
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/.gitignore
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/apps/JSDOS/config.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/apps/JSDOS/useDosCI.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/apps/JSDOS/useJSDOS.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/apps/Emulator/config.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/apps/Emulator/useEmulator.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/hooks/useSnapshots.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/hooks/useIsolatedContentWindow.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/contexts/process/directory.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/components/system/Files/FileEntry/extensions.ts
- https://github.com/DustinBrett/daedalOS/blob/0df82d75e6114727ad035f6fce93842a96682355/public/CREDITS.md

### js-dos

- https://js-dos.com/emulators.html
- https://js-dos.com/player-api.html
- https://js-dos.com/save-load-game-progress.html
- https://js-dos.com/v7/build/docs/save-load/
- https://www.npmjs.com/package/emulators
- https://www.npmjs.com/package/js-dos

### EmulatorJS

- https://github.com/EmulatorJS/EmulatorJS
- https://github.com/EmulatorJS/EmulatorJS/releases
- https://github.com/EmulatorJS/EmulatorJS/blob/main/data/src/GameManager.js
- https://github.com/EmulatorJS/EmulatorJS/blob/main/data/src/storage.js
- https://github.com/EmulatorJS/EmulatorJS/blob/main/data/src/emulator.js
- https://github.com/EmulatorJS/EmulatorJS/blob/main/data/src/consts.js
- https://emulatorjs.org/docs/systems/

### Licensing/content evidence

- Anguna: https://github.com/retrobrews/gba-games/blob/add86969f1a7a3b9534822a9a015d05ed20a0dcf/anguna.txt
- Alter Ego: https://forums.nesdev.org/viewtopic.php?t=10404
- Mega Q*bert: https://jaklub.itch.io/mega-qbert
- School Rush: https://pypebros.itch.io/bilou-school-rush
- Halo 2600: https://americanart.si.edu/artwork/halo-2600-82224
- Classic Kong `(PD)` terminology caution: https://www.nesdev.org/wiki/Public_domain
- Doom engine/data distinction: https://github.com/id-Software/DOOM
- Doom shareware license copy: https://sources.debian.org/src/doom-wad-shareware/1.9.fixed-2/debian/copyright/
- Duke source/data distinction: https://github.com/videogamepreservation/dukenukem3d

---

## Design-phase confirmations

- No production implementation was added.
- No new ROM binaries or new copyrighted game content were added by this design correction.
- No DOS commercial/shareware game data was added by this design correction.
- Existing intended/provided demo assets are allowed to remain in hackathon/development content under the temporary/unverified policy; this document does not claim they are legally cleared.
- No proof code was added; source inspection was sufficient to answer the design questions.
- No Plasmon frozen OS contracts were changed.
- No MTN, Sharing, Atom, Kernel, Shell/Desktop production code, Agent 10 filesystem design, Agent 11 theme design, or package lock was changed.
- The `.sys` wrapper concept is explicitly rejected for js-dos and EmulatorJS.
- The known daedalOS game-format parity target is explicitly `.jsdos`, `.nes`, `.gba`, `.gen`, `.nds`, `.a26`, `.smc`.
- No pull request is required or intended for this Agent 12 handoff.
