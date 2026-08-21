# Games

`src/games/` contains Plasmon-owned game content and bootstrap glue. It is not a parallel launcher, emulator shell, or resource-dispatch architecture.

## Architecture

Game resources participate in the same filesystem/opening model as other user resources. Runtime selection belongs to associations and the owning runtime implementation; Shell, Desktop, FileManager, and generic filesystem code should not acquire game-title-specific behavior.

Reusable game runtimes belong under the appropriate native-app/runtime boundary. Game content, metadata, bootstrap/import behavior, and game-specific persistence concerns belong here only when they are genuinely game-domain responsibilities.

Durable emulator progress remains owned by the runtime plus the canonical Plasmon filesystem service. For js-dos, the runtime stores its opaque exported change set by stable game `NodeId`; filename/path changes are presentation changes, not save identity. Browser-local emulator persistence must not become a second Plasmon save database.

## Direction

Keep game support data- and association-driven so new bundle formats or runtimes can be added without special-casing individual games. Prefer shared filesystem, process, windowing, visual, and runtime authorities rather than creating a second game-specific copy of those systems.

Temporary/demo/bootstrap content must remain separable from durable product defaults and must preserve licensing/redistribution metadata.

## Deferred full-profile demo fixture

The hackathon core r2 package deliberately omits js-dos/EmulatorJS runtimes,
ROMs, and demo game bundles. The source and acceptance fixture remain available
as deferred full-profile evidence for a later optional-runtime distribution;
they are not materialized by the core package build.

When the full profile is intentionally restored, the build deterministically
generates `fixtures/PlasmonDemo.jsdos` from `demoFixtureBundle.ts`. The bundle
contains only a tiny Plasmon-authored keyboard DOS program, its `dosbox.conf`,
and a provenance/readme file; it contains no commercial or third-party game
data and is distributed under the repository GNU GPL version 3 license.

The demo creates `SCORE.DAT` inside the emulated filesystem on first run and updates it on SPACE. When that file arrives through a restored js-dos change set, the program announces restored progress. This behavior exists solely so installed-package acceptance can exercise a real legal filesystem mutation and save/close/reopen path; it does not create a privileged Product save format or game-title-specific runtime rule.

Normal OS boot does **not** import this content. To enable the fixture, load the Plasmon application URL with:

```text
?plasmon-fixture=demo-game
```

For example, standalone development can use `http://localhost:5173/?plasmon-fixture=demo-game`; an installed Neutron package uses the same query on its `/app/plasmon/index.html` URL. The flag causes `demoFixture.ts` to fetch that package-local asset before service composition and pass exactly one `demo-temporary` seed through the existing filesystem bootstrap authority. On a fresh fixture profile this creates:

```text
/Games/Plasmon Demo.jsdos
```

The filesystem demo-seed ledger remains authoritative, so repeated flagged starts do not create duplicates or resurrect a fixture a user deliberately deleted from the same profile. Demo/acceptance setup should therefore use a fresh/reinstalled profile when it requires the fixture to be recreated.

After setup, the fixture has no privileged execution path. Open it from FileManager/Search like any other resource:

```text
filesystem node
  -> AssociationRegistry (.jsdos)
  -> OpenService
  -> Process / Windowing
  -> runtime:js-dos
  -> /System/Program Files/js-dos
```

The installed Playwright demo-game acceptance uses this same URL flag and filesystem resource. It must not invoke the js-dos runtime directly. Persistence acceptance closes the normal js-dos Process, then reopens that same filesystem resource through FileManager and requires the runtime to consume the filesystem-backed change set before returning to gameplay readiness.

## Testing

Deterministic game metadata, bootstrap, association, save-state, and routing logic should be tested headlessly where practical. Use package/browser verification only for boundaries that require a real installed asset or runtime: HTTP serving, iframe/runtime initialization, input, fullscreen, audio/video, persistence lifecycle, or actual playability.

A generated asset existing in build output is package evidence, not proof that the installed application serves or executes it correctly.

## Deeper design

See:

- `../../docs/GAMES_DAEDALOS_ARCHITECTURE.md`
- `../../docs/FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md`
- `../native-apps/emulatorjs/README.md`
- `../native-apps/jsdos/README.md`
- `../os/fs/README.md`
