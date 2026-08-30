# Plasmon OS implementation instructions

## Scope

Applies to `apps/plasmon/src/os/**` together with parent instructions. Read the nearest subsystem README and `AGENTS.md` before editing.

## Durable invariants

- Shared concepts come from `contracts/**`; consumers must not create incompatible local versions.
- `api/**` is the dependency-light production semantic OS capability boundary for legitimate high-level automation. Its adapter delegates to existing authorities; it must not become a second policy implementation or test-only facade.
- `diagnostics/**` is the single Plasmon diagnostic authority. Production code that needs operational logging obtains a subsystem-scoped logger with `diagnostics.for("<subsystem>")`; it does not create a local logger, call a sink directly, or decide whether an event goes to `system.log`, browser console, tests, or remote reporting.
- Diagnostic event names are stable machine identities, lowercase dot-separated descriptions such as `file.write.failed` or `process.start.failed`. Human prose belongs in the optional `message` field, not in the event identity.
- Diagnostic fields must be bounded and safe. Never log credentials, bearer/capability material, cookies, document contents, arbitrary filesystem/runtime dumps, or private state merely because redaction exists. Paths and names may be sensitive and should be included only when needed to diagnose the operation.
- Logging supplements rather than replaces Product behavior. Actionable user-facing errors remain owned by the Product surface; diagnostic failure must never fail the operation being observed.
- Direct production `console.*` is prohibited except for explicit bootstrap-last-resort or diagnostic-sink-failure paths mechanically allowlisted by the console-policy test. Do not add an exception when a canonical diagnostic event can own the signal.
- Filesystem semantics and mutation remain behind the filesystem/core contracts.
- Stable identifiers must remain stable across presentation changes such as rename, move, focus, or view changes.
- Generic resource opening is shared infrastructure. Desktop, FileManager, Start, Search, and native apps should delegate instead of growing private dispatch tables.
- Desktop/FileManager/Shell are presentation and interaction layers, not replacement persistence authorities.
- Native process/window state is Plasmon-local and must remain distinct from Neutron application/AppScope state.
- Neutron bridge code may expose only behavior supported by the actual Kernel contract/implementation.
- Shared visual primitives describe presentation; semantic classification belongs to the owning resource/application subsystem.
- Atom/resource semantics and cross-AppScope authorization remain separate responsibilities according to accepted contracts.

Do not encode an individual bug fix, suffix rule, demo resource, historical agent decision, or temporary migration as a generic OS invariant unless it is truly architectural. Put those details in the responsible Issue, test, contract, or design record.

## Diagnostic severity

Use the lowest truthful severity:

- `debug` — developer-only detail useful while diagnosing an operation; normally absent from the durable default log.
- `info` — routine but diagnostically useful lifecycle evidence worth retaining when enabled.
- `notice` — meaningful successful system lifecycle transition, used sparingly.
- `warn` — degraded/rejected/recoverable behavior that deserves investigation but did not make the owning operation fatally fail.
- `error` — an operation or owned capability failed.
- `critical` — Plasmon cannot establish or preserve a core operating boundary, such as failed system bootstrap.

Do not persist ordinary clicks, focus, resize, mouse movement, successful reads/listing, or other high-volume interaction traffic merely because it is observable.

## Refactor direction

Prefer a structure where user actions have a production headless seam beneath React. As components grow, extract reusable models/controllers/commands rather than keeping mutation and lifecycle rules embedded only in event handlers.

Converge duplicated behavior on the owning subsystem:

- dependency-light high-level OS automation capabilities -> `api/**`, implemented only by delegation to the owning authorities;
- structured operational diagnostics -> `diagnostics/**`;
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

When the behavior under test includes diagnostics, assert the structured production record through `env.diagnostics` or the owning `DiagnosticService`; do not parse console text or `/System/system.log` strings when structured observation can prove the event. Logging is additional evidence, not a substitute for asserting the Product result.

Add integration tests for contract/composition boundaries. Use browser tests where real DOM/browser/runtime mechanics matter, and package/installed checks where the artifact is part of the claim.

A passing unit test does not prove the active packaged path. Conversely, do not force deterministic semantics into slow browser tests when production headless code can prove them cheaply.

## Escalate

Escalate shared-contract, persistence/schema, unverified Kernel-capability, security-boundary, or release/version changes rather than inventing compatibility shims.
