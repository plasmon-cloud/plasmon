# Filesystem dependency handoff

## Runtime: `@sqlite.org/sqlite-wasm`

Needed for the preferred SQLite WASM + OPFS backend.

Integration requirements:

- add the official `@sqlite.org/sqlite-wasm` runtime package to the Plasmon workspace;
- bundle/copy its WASM assets in a dedicated filesystem Worker;
- initialize the OPFS SAH-pool VFS (`opfs-sahpool`) in that Worker;
- expose an `FsRepository` adapter/factory to `createBrowserFsRepository({ sqliteRepositoryFactory })`;
- preserve IndexedDB as fallback when SQLite/OPFS initialization is unavailable or fails.

Reason the package is not added here: subsystem agents do not modify shared `package.json`/lockfiles merely to add dependencies. The filesystem implementation compiles and runs with IndexedDB persistence until integration reconciles the shared dependency and Worker asset wiring.

No other filesystem-specific shared dependency is required.
