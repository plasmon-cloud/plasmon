# Plasmon OS implementation instructions

## Scope

Applies to `apps/plasmon/src/os/**` together with parent instructions. Read the nearest subsystem README and `AGENTS.md` before editing.

## Durable invariants

- Shared concepts come from `contracts/**`; consumers must not create incompatible local versions.
- `api/**` is the dependency-light production semantic OS capability boundary for legitimate high-level automation. Its adapter delegates to existing authorities; it must not become a second policy implementation or test-only facade.
- Filesystem semantics and mutation remain behind the filesystem/core contracts.
- Stable identifiers must remain stable across presentation changes such as rename, move, focus, or view changes.
- Generic resource opening is shared infrastructure. Desktop, FileManager, Start, Search, and native apps should delegate instead of growing private dispatch tables.
- Desktop/FileManager/Shell are presentation and interaction layers, not replacement persistence authorities.
- Native process/window state is Plasmon-local and must remain distinct from Neutron application/AppScope state.
- Neutron bridge code may expose only behavior supported by the actual Kernel contract/implementation.
- Shared visual primitives describe presentation; semantic classification belongs to the owning resource/application subsystem.
- Atom/resource semantics and cross-AppScope authorization remain separate responsibilities according to accepted contracts.

Do not encode an individual bug fix, suffix rule, demo resource, historical agent decision, or temporary migration as a generic OS invariant unless it is truly architectural. Put those details in the responsible Issue, test, contract, or design record.

## Refactor direction

Prefer a structure where user actions have a production headless seam beneath React. As components grow, extract reusable models/controllers/commands rather than keeping mutation and lifecycle rules embedded only in event handlers.

Converge duplicated behavior on the owning subsystem:

- dependency-light high-level OS automation capabilities -> `api/**`, implemented only by delegation to the owning authorities;
- filesystem state/mutations -> `fs/**`;
- handler matching/defaults -> `associations/**`;
- native lifecycle -> `process/**`;
- window mechanics -> `windowing/**`;
- Kernel integration -> `neutron/**`;
- cross-subsystem construction -> `integration/**`;
- common presentation -> `visual/**`.

Major cleanup/refactor work should be issue-driven and independently verifiable rather than silently broadening a feature patch.

## Testing

Use focused subsystem tests for deterministic behavior, then the Plasmon fast suite. For new high-level deterministic workflows spanning OS authorities, prefer the production `OsApi` exposed by the headless environment as `env.os` when it represents the needed legitimate operation. Do not introduce new raw service-graph choreography, legacy headless-helper usage, or Playwright automation merely because it is convenient when `env.os` already proves the claim.

Focused subsystem/unit tests should continue calling their owning production model/service/controller/command directly; do not force every test through `OsApi`. If a legitimate high-level OS operation is missing from the API, evaluate that as a production `OsApi` gap. Test-only settlement, effect control, clocks, transport faults, impossible-state construction, and assertions stay outside the production API.

Add integration tests for contract/composition boundaries. Use browser tests where real DOM/browser/runtime mechanics matter, and package/installed checks where the artifact is part of the claim.

A passing unit test does not prove the active packaged path. Conversely, do not force deterministic semantics into slow browser tests when production headless code can prove them cheaply.

## Escalate

Escalate shared-contract, persistence/schema, unverified Kernel-capability, security-boundary, or release/version changes rather than inventing compatibility shims.
