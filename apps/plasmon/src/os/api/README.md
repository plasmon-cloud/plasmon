# Plasmon semantic OS API

`api/` is the production-owned semantic automation boundary for Plasmon OS capabilities.

The public contracts in `contracts.ts` are deliberately dependency-light: they do not import concrete filesystem, association, process, window, React, repository, Neutron transport, or test classes. `adapter.ts` binds those contracts to the real `PlasmonServices` composition.

```text
OS API contracts / DTOs
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

- The OS API contains legitimate OS operations and observability that a normal authorized caller could reasonably use.
- The adapter delegates to the owning production authorities. It must not reproduce filesystem protection, association selection, open dispatch, process lifecycle, window policy, Trash policy, or package/install authority.
- Public results are semantic DTOs rather than mutable internal service/controller records.
- Test-only powers such as global deterministic settlement, fake-effect failure/defer controls, clock manipulation, impossible-state construction, transport fault injection, and assertions do not belong here.
- Focused subsystem tests should continue testing their subsystem directly. The OS API is primarily for high-level deterministic workflows that span production authorities.

## Current scripting surface

The bounded production surface exposes:

```ts
os.fs.stat(path)
os.fs.exists(path)
os.fs.list(path)
os.fs.readText(path)
os.fs.writeText(path, content)
os.fs.createDirectory(path)
os.fs.copy(sourcePath, destinationPath)
os.fs.move(sourcePath, destinationPath)
os.fs.remove(path)

os.open(path)

os.processes.list()
os.windows.list()
```

All filesystem paths are absolute. `writeText()` creates or replaces a UTF-8 text file through the protected user-facing filesystem facade. `createDirectory()` creates one directory whose parent already exists. `list()` delegates direct-child enumeration to the production filesystem authority and returns stable `OsResource` DTOs without adding shell presentation semantics such as cwd, sorting flags, globbing, recursion, or formatting.

`copy()` and `move()` take an absolute source path plus an absolute destination path that must resolve to an existing directory. They preserve the source name and delegate collision, protection, recursive-copy, stable-identity, and move rules to the protected production `FsService`. The OS API deliberately does not synthesize Unix-style rename-on-destination behavior by sequencing separate rename/move mutations.

`remove()` is the ordinary user-facing Plasmon removal operation. It delegates to the filesystem core Trash authority, so removable resources are moved to Recycle Bin with the existing metadata/stable-identity behavior and protected resources remain protected. It is not a permanent-delete primitive.

`open()` invokes the canonical filesystem open dispatcher and always returns the requested `OsResource`. Native `handlerId`/`processId`/`windowId` fields are reported only when the resulting Plasmon-native process is directly targeted at that requested resource. Indirect opens such as shortcuts or Kernel-owned Neutron applications may therefore omit those optional fields rather than guessing process attribution.

## Package/provisioning boundary

There is intentionally no `os.packages` API in the current surface.

The current production Neutron bridge can discover installed Elements and can request the Kernel-owned, user-reviewed installation-offer flow for a source URL. That is not a generalized package manager with an `install(packageIdOrSource) -> installed package` completion contract. More importantly, vanilla Neutron currently exposes no supported ordinary-application API for requesting uninstall/removal; uninstall remains Kernel frontend orchestration with dependency checks, destructive confirmation, deployment, AppScope cleanup, and security authority.

Because a coherent production `list/install/remove` authority does not yet exist at the application boundary, the OS API must not invent one or delete `/Apps/*.neutron` projections locally. Package provisioning remains a production API gap until Neutron exposes the missing supported authority. See `../neutron/README.md` for the current installation/uninstall boundary.

## Scripting separation

Broader scripting concerns remain intentionally separate. A future executable runtime may provide a `RunContext` for args/stdin/stdout/stderr/cancellation, while shell commands may live in a `CommandRegistry` built above the OS API. cwd, pipelines, redirects, shell formatting, text transforms, history, variables, aliases, command parsing, and Terminal presentation do not belong on this contract.

The contract is structured so it can later be extracted into a reusable SDK and used as the source of TypeScript/Monaco declarations without changing its dependency direction. Physical SDK extraction and scripting integration are intentionally separate follow-up work.
