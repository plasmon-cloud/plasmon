# OS integration


`integration/**` is the Plasmon OS composition boundary. It wires subsystem implementations together through their public contracts; it should not become a second home for subsystem policy.

## Current composition

`services.ts` constructs the filesystem frontend transport, filesystem core, association/default store, native application registry, process/window managers, Neutron bridge, OpenService, authorization seam, and shared file-operation clipboard. It registers built-in native applications plus runtime handlers enabled by the current package profile, then returns the public service graph consumed by `PlasmonOS.tsx`.

`packageProfile.ts` is the narrow build/runtime seam for those package-profile decisions. Current shipped profiles deliberately disable the optional game/emulator runtime handlers and payloads so a packaged resource cannot route into a runtime that was not shipped. Unbundled/direct runtime tests retain the full source graph through the fallback profile values. Package-profile gating is composition policy only: it must not become a second application catalog, association authority, or runtime implementation.

Hosted Plasmon routes filesystem persistence through the persistent background/RPC boundary; standalone preview uses a browser-selected local repository. These modes should expose the same public filesystem semantics even though their persistence transport differs. Association defaults use `FsServiceAssociationDefaultStore` over that same filesystem authority in both modes; foreground `localStorage` is not an association-default persistence authority.

`openService.ts` executes resolved handlers through the relevant public runtime/Kernel services. Fakes under this directory are test/preview seams and are never evidence that a production Kernel/security capability exists.

The essential runtime boundary remains:

```text
Plasmon native app -> Plasmon process/window host
Neutron application -> Kernel-owned surface
```

## Operational coordination

This directory intentionally does not maintain per-agent branch or ownership handoffs. Current work is routed through canonical GitHub Issues/Areas and repository assignment/ownership mechanisms. Historical wave-era and branch-specific handoffs remain available in Git history only and must not be treated as active integration instructions.

## Refactor direction

Keep the service graph explicit and composition small. When integration code accumulates filename/app-specific policy, move that policy to the owning subsystem and keep only dependency wiring here.

Retire legacy adapters only after current consumers are migrated and verified. Avoid wholesale replacement of composition files with stale branch versions; integration must preserve compatible subsystem behavior from all merged work.

Shared dependency/build/package changes that affect multiple subsystems should be applied centrally and tested as package composition rather than hidden inside one feature directory.

## Testing

Use composition tests to prove the real public implementations are wired together, profile-disabled handlers remain absent where required, and fakes remain confined to their intended modes. Association-default composition coverage should verify persistence through the filesystem authority and reconstruction from the same repository. Add package/browser coverage when hosted-vs-standalone transport, built assets, workers/runtime files, package-profile omissions, or the active packaged entrypoint are part of the claim.

A fake service proves caller behavior, not existence of a production Kernel/authorization capability.
