# Plasmon semantic OS API

`api/` is the production-owned semantic automation boundary for Plasmon OS capabilities.

The public contracts in `contracts.ts` are deliberately dependency-light: they do not import concrete filesystem, association, process, window, React, repository, Neutron transport, or test classes. `adapter.ts` binds those contracts to the real `PlasmonServices` composition.

```text
OsApi contracts / DTOs
        |
createPlasmonOsApi(...)
        |
production Plasmon authorities
      /                 \
 future scripting       env.os
                        /    \
                  headless   RTL
```

## Boundary rules

- `OsApi` contains legitimate OS operations and observability that a normal authorized caller could reasonably use.
- The adapter delegates to the owning production authorities. It must not reproduce filesystem protection, association selection, open dispatch, process lifecycle, or window policy.
- Public results are semantic DTOs rather than mutable internal service/controller records.
- Test-only powers such as global deterministic settlement, fake-effect failure/defer controls, clock manipulation, impossible-state construction, transport fault injection, and assertions do not belong here.
- Focused subsystem tests should continue testing their subsystem directly. `OsApi` is primarily for high-level deterministic workflows that span production authorities.

## Initial R3 surface

The bounded R3 foundation exposes:

```ts
os.fs.stat(path)
os.fs.exists(path)
os.fs.readText(path)
os.fs.writeText(path, content)
os.fs.createDirectory(path)
os.fs.list(path)

os.open(path)

os.processes.list()
os.windows.list()
```

`writeText()` creates or replaces a UTF-8 text file through the protected user-facing filesystem facade. `createDirectory()` creates one directory whose parent already exists. `list()` accepts an absolute directory path, delegates direct-child enumeration to the production filesystem authority, and returns stable `OsResource` DTOs without adding shell presentation semantics such as cwd, sorting flags, globbing, recursion, or formatting. `open()` invokes the canonical filesystem open dispatcher and reports the requested resource plus native process/window identities when the operation creates or reuses them.

Broader scripting concerns are intentionally separate. A future executable runtime may provide a `RunContext` for args/stdin/stdout/stderr/cancellation, while shell commands may live in a `CommandRegistry` built above `OsApi`. Those concerns must not become miscellaneous `OsApi` methods merely because scripting needs them.

The contract is structured so it can later be extracted into a reusable SDK and used as the source of TypeScript/Monaco declarations without changing its dependency direction. Physical SDK extraction and scripting integration are not part of this R3 testing pass.
