# Plasmon diagnostics

`diagnostics/` owns Plasmon-local structured diagnostic events and their local sinks.

The production authority is `PlasmonDiagnosticService`. Callers emit one structured event with a severity, subsystem, stable event name, human-readable message, optional correlation id, optional safe context, and optional error. The service then applies sink policy:

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

## Durable rules

- `/System/system.log` is the durable Plasmon-local representation. It is stored through the existing Plasmon filesystem authority; browser console output is never the authoritative copy.
- Event emission is failure-isolated. A logging, console, or subscriber failure must not fail the Product operation that produced the diagnostic event.
- The file is line-oriented and human-readable, while retaining stable severity/subsystem/event/correlation/context fields.
- Retention is bounded by bytes. When the high-water mark is exceeded, the oldest complete lines are removed until the retained target is reached. If the newest record itself exceeds the file ceiling, its prefix is preserved, its tail is UTF-8-safely truncated, and an explicit truncation marker is appended so timestamp/severity/subsystem/event identity remain diagnosable.
- Sensitive context keys and common bearer/query-token forms are redacted before either filesystem or console output. Diagnostics are not permission to dump document contents, credentials, capabilities, cookies, authorization headers, or arbitrary private state.
- Production code should emit stable event names such as `filesystem.bootstrap.ready` or `process.start.failed`; UI prose is not the event identity.
- `debug`/`info`/`notice`/`warn`/`error`/`critical` are the supported levels. File and console minimum levels are separate policy so dogfood/test builds can be more verbose without changing event producers.
- Do not replace actionable user-facing errors with log-only reporting. Logging records what happened; the owning Product surface still decides whether user notification is required.

## Scope boundary

This subsystem is local diagnostics, not analytics or remote observability. Remote upload, third-party error monitoring, GitHub issue automation, and Kernel-wide logging are separate work and must consume an explicitly sanitized boundary rather than treating the local file as an upload payload.
