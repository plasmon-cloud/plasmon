# Plasmon diagnostics

`diagnostics/` owns Plasmon-local structured diagnostic events and their sinks.

The production authority is `PlasmonDiagnosticService`. Product code scopes a logger once to the owning subsystem and emits stable named events through that logger:

```ts
const log = diagnostics.for(DiagnosticSubsystem.Filesystem);

log.error(DiagnosticEvent.Filesystem.TrashFailed, {
  operation: DiagnosticOperation.Delete,
  error,
});
```

`message`, `error`, and `correlationId` are reserved fields. Any other fields become structured context. An explicit `context` object is merged with those fields. If `message` is omitted, the stable event name is also used as the human-readable fallback. Callers do not pre-redact data; the diagnostic authority sanitizes every record before any sink or subscriber observes it.

```text
production subsystem
      |
      v
DiagnosticService.for(subsystem)
      |
      v
DiagnosticService
  |      |       |
  |      |       +-> subscribers / deterministic observation
  |      +----------> browser console (filtered, best-effort)
  +-----------------> /System/system.log (filtered, bounded, durable)
```

## Producer guide

Unexpected uncaught failure: throw normally; global diagnostics captures it. Handled/swallowed meaningful failure: emit once at the owning boundary using canonical vocabulary. Never invent subsystem, event, runtime, operation, or stage strings.

```ts
const log = diagnostics.for(DiagnosticSubsystem.Process);
log.error(DiagnosticEvent.Process.StartFailed, {
  operation: DiagnosticOperation.Start,
  stage: DiagnosticStage.WindowCreate,
  errorType,
});
```

## Producer contract

- Scope with `diagnostics.for(DiagnosticSubsystem.<Owner>)`; do not build subsystem-local logger wrappers or call sink-specific APIs.
- Use `debug`, `info`, `notice`, `warn`, `error`, and `critical` consistently. Routine high-volume interactions should usually not be diagnostic events at all.
- Event names are stable machine identities, lowercase dot-separated phrases such as `filesystem.bootstrap.ready`, `process.start.failed`, or `file.write.failed`. Do not use UI prose, Issue numbers, release names, or temporary implementation vocabulary as event identities.
- Include a `message` only when it makes the record more useful to a human than the event name alone.
- Put useful bounded metadata in structured fields. Never log document/file contents, credentials, tokens, cookies, capabilities, authorization headers, private keys, ROM/game payloads, or arbitrary state dumps.
- Pass failures as `error`; do not stringify stacks or error objects in subsystem code.
- Pass operation correlation through `correlationId`. Do not invent separate tracing/logging stores. The correlation propagation contract is extended by the tracing owner, while the event field remains stable here.
- Do not replace actionable user-facing errors with logging. Diagnostics record what happened; the owning Product surface still decides what the user must see.
- Do not call BugSnag or any future remote sink from subsystem code. Remote reporting consumes the same sanitized canonical stream.

## Direct console policy

Production `console.*` is not a normal producer API. A fast source guard rejects new direct calls outside the canonical diagnostics console sink and narrowly documented bootstrap/emergency exceptions.

An exception is valid only when routing the event through `DiagnosticService` would be impossible or recursive. The current exception set is deliberately small: standalone storage fallback before diagnostics has a filesystem, the diagnostic filesystem sink's own failure callback, and the privileged filesystem background surface's storage/invalidation failures because that surface owns the persistence authority used by `/System/system.log`. Those exact call sites are enumerated by the source guard; adding another direct console call requires changing that executable inventory and documenting the architectural reason.

Tests may use console output as test infrastructure when appropriate; the production-source guard intentionally applies only to non-test source.

## Durable rules

- `/System/system.log` is the durable Plasmon-local representation. It is stored through the existing Plasmon filesystem authority; browser console output is never the authoritative copy.
- Event emission is failure-isolated. A logging, console, remote-sink, or subscriber failure must not fail the Product operation that produced the diagnostic event.
- The file is line-oriented and human-readable, while retaining stable severity/subsystem/event/correlation/context fields.
- Retention is bounded by bytes. When the high-water mark is exceeded, the oldest complete lines are removed until the retained target is reached. A single oversized newest record preserves its prefix/event identity, truncates on Unicode-safe boundaries, and carries an explicit truncation marker.
- Sensitive context keys and common bearer/query-token forms are redacted before any sink or subscriber receives the normalized record. Diagnostics are not permission to dump private state.
- File and console minimum levels are separate policy so development and test builds can be more verbose without changing event producers.

## Testing contract

Focused/headless tests use `observeDiagnostics(env.diagnostics)` from `apps/plasmon/test/diagnosticObserver.ts`. The helper only subscribes to the production `DiagnosticService`, delegates deterministic settlement to `DiagnosticService.flush()`, and filters exact structured identity by `subsystem`, `event`, `level`, and an optional naturally-present `correlationId`. It is not a logger or a timing utility.

Behavior/state assertions remain primary. Add a diagnostic assertion when the stable event proves a useful failure or lifecycle boundary that ordinary state alone does not explain. Do not assert diagnostics merely because an event exists, do not depend on incidental record order or human message wording, and do not require Product code to manufacture correlation metadata for a test. When the structured subscriber stream is available, use it rather than parsing `system.log`.

Packaged/browser tests cannot directly subscribe to the in-app service without adding a Product-only-for-tests API. For representative packaged acceptance, `test/e2e/plasmon-diagnostic-artifact.ts` observes the existing production console sink and, only on test failure, can attach a bounded tail containing timestamp, level, subsystem, and event identity. The artifact parser rejects arbitrary console text and drops message, context, error, correlation values, paths, URLs, credentials, and other payload before attachment. It is debugging evidence only.

BrowserHealth remains independent and strict. Page errors, request/response failures, and disallowed console warnings/errors still fail the browser test even when a matching diagnostic identity is retained as an artifact. Diagnostic evidence never adds a BrowserHealth allow rule.

## Scope boundary

This subsystem owns the canonical sanitized Plasmon diagnostic stream and local sinks. Remote error monitoring, settings-controlled sink policy, correlation propagation, and broad subsystem instrumentation extend this stream without creating another producer API. Test-only artifact retention may observe existing production sinks but does not become a producer or sink authority. Kernel-wide logging remains Neutron-owned.
