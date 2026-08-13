# Games

`src/games/` contains Plasmon-owned game content and bootstrap glue. It is not a parallel launcher, emulator shell, or resource-dispatch architecture.

## Architecture

Game resources participate in the same filesystem/opening model as other user resources. Runtime selection belongs to associations and the owning runtime implementation; Shell, Desktop, FileManager, and generic filesystem code should not acquire game-title-specific behavior.

Reusable game runtimes belong under the appropriate native-app/runtime boundary. Game content, metadata, bootstrap/import behavior, and game-specific persistence concerns belong here only when they are genuinely game-domain responsibilities.

## Direction

Keep game support data- and association-driven so new bundle formats or runtimes can be added without special-casing individual games. Prefer shared filesystem, process, windowing, visual, and runtime authorities rather than creating a second game-specific copy of those systems.

Temporary/demo/bootstrap content must remain separable from durable product defaults and must preserve licensing/redistribution metadata.

## Explicit packaged demo fixture

Plasmon ships one deliberately opt-in js-dos fixture for development, demos, and installed-package acceptance. The build deterministically generates `fixtures/PlasmonDemo.jsdos` from `demoFixtureBundle.ts`. The bundle contains only a tiny Plasmon-authored keyboard DOS program, its `dosbox.conf`, and a provenance/readme file; it contains no commercial or third-party game data and is distributed under the repository GNU GPL version 3 license.

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

The installed Playwright demo-game acceptance uses this same URL flag and filesystem resource. It must not invoke the js-dos runtime directly.

## Testing

Deterministic game metadata, bootstrap, association, save-state, and routing logic should be tested headlessly where practical. Use package/browser verification only for boundaries that require a real installed asset or runtime: HTTP serving, iframe/runtime initialization, input, fullscreen, audio/video, or actual playability.

A generated asset existing in build output is package evidence, not proof that the installed application serves or executes it correctly.

## Deeper design

See:

- `../../docs/GAMES_DAEDALOS_ARCHITECTURE.md`
- `../../docs/FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md`
- `../native-apps/emulatorjs/README.md`
- `../native-apps/jsdos/README.md`
- `../os/fs/README.md`
