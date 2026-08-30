# Plasmon diagnostics

`diagnostics/` owns Plasmon-local structured diagnostic events and their sinks.

The production authority is `PlasmonDiagnosticService`. Product code should obtain one subsystem-scoped producer and emit stable events without knowing which sinks consume them:

```ts
const log = diagnostics.for("filesystem");

log.info("file.move.completed", { count: 3 });
log.error("file.write.failed", {
  message: "Filesystem write failed",
  path,
  error,
});
```

`message`, `correlationId`, and `error` are reserved producer fields. Other fields become sanitized structured context. If `message` is omitted, the stable event name is also used as the human-readable fallback. Correlation is accepted at this boundary so operation tracing can propagate it without creating another logger.

```text
production subsystem
      |
      v
DiagnosticService
  |      |       |
  |      |       +-> subscribers / deterministic observation
  |      +----------> browser console (filtered, best-effort)
  +-----------------> /System/system.log (filtered, bounded, durable)
```

Future remote reporting is another sink behind this same sanitized authority; producers do not import or call a remote SDK.

## Producer contract

- Create a logger once for the owning subsystem with `diagnostics.for("<subsystem>")` and use `debug`, `info`, `notice`, `warn`, `error`, or `critical`.
- Subsystem and event names are stable lowercase machine identities. Prefer dot-separated event names describing the operation and outcome, for example `filesystem.bootstrap.ready`, `file.write.failed`, or `process.start.failed`. Hyphens are acceptable inside an established identifier segment where the owning subsystem already uses them; do not encode prose into the name.
- Event identity is not UI prose and must not contain filenames, paths, IDs, error messages, or other occurrence-specific values.
- Use `debug` for developer detail, `info` for routine diagnostic lifecycle evidence, `notice` for meaningful successful system transitions, `warn` for degraded/recoverable behavior, `error` for a failed owned operation/capability, and `critical` only when a core Plasmon operating boundary cannot be established or preserved.
- Log at the lowest truthful owner. Do not duplicate the same failure at every caller merely to prove coverage; higher layers should add an event only when they own a distinct operation or can add materially different lifecycle evidence.
- Do not log routine clicks, focus, resize, successful reads/listing, pointer traffic, or other high-volume interaction events.
- Logging supplements user-facing error handling; it never replaces a truthful actionable Product error.

## Direct console policy

Production source must not accumulate ad-hoc `console.*` logging. The automated console-policy test permits only explicit bootstrap-last-resort or diagnostic-sink-failure calls that cannot safely use `DiagnosticService` itself. New Product diagnostics use the scoped producer instead of extending that exception list.

## Durable rules

- `/System/system.log` is the durable Plasmon-local representation. It is stored through the existing Plasmon filesystem authority; browser console output is never the authoritative copy.
- Event emission is failure-isolated. A logging, console, subscriber, or future remote-sink failure must not fail the Product operation that produced the event.
- The file is line-oriented and human-readable, while retaining stable severity/subsystem/event/correlation/context fields.
- Retention is bounded by bytes. When the high-water mark is exceeded, the oldest complete lines are removed until the retained target is reached. If the newest record itself exceeds the file ceiling, its prefix is preserved, its tail is UTF-8-safely truncated, and an explicit truncation marker is appended so timestamp/severity/subsystem/event identity remain diagnosable.
- Sensitive context keys and common bearer/query-token forms are redacted before sinks see them. Redaction is defense in depth, not permission to emit document contents, credentials, capabilities, cookies, authorization material, or arbitrary private state.
- Paths and filenames are potentially sensitive. Include them only where the operation cannot be diagnosed with a safer stable identifier or bounded classification.
- File and console minimum levels are sink policy. Producers emit the same event regardless of current sink thresholds.

## Testing

Focused tests may subscribe to the production `DiagnosticService`; cross-system deterministic tests use `env.diagnostics`. Assert structured fields rather than parsing formatted console/system-log strings unless formatting/persistence itself is the behavior under test. Diagnostic assertions accompany the Product assertion rather than replacing it.

## Scope boundary

This subsystem is diagnostics, not analytics or a remote-vendor API. Remote upload, third-party error monitoring, AI/GitHub issue automation, and Kernel-wide logging must consume the sanitized structured boundary rather than treating `/System/system.log` as an upload payload or becoming a second producer authority.
