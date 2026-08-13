# Issue #115 preserve / change / unspecified

## PRESERVE

- Filesystem identity, resource policy, Trash metadata, shortcut serialization, and association matching remain owned by their existing services.
- Shell Start/Search opening delegates to the canonical dispatcher; taskbar native actions delegate to Process/Windowing.
- Neutron Element opening and runtime uncertainty remain bridge-owned.
- Close negotiation continues to accept dirty-document veto/defer through Process (#41/#42).
- Commands expose capability/outcome projection; they do not become a `ResourceService` or durable authority.

## CHANGE

- Select only actions with two real consumers and observable divergence.
- Give those actions one production orchestration seam and migrate both consumers.
- Return deterministic enabled/disabled and success/failure/defer outcomes suitable for keyboard, menu, context-menu, and toolbar adapters.
- Add cross-surface headless tests that invoke real authorities.

## UNSPECIFIED

- Generic command registry/framework, undo/jobs, plugin commands, application-internal editor commands, and commands with only one current consumer.
- Whether `Close`, `Show Desktop`, and TaskManager actions are part of the first #115 set; their canonical Issues own acceptance.
- Source file location, class names, hook counts, and component size.

## Honest RED rule

A command gate may assert a user-visible capability or outcome mismatch. It must not assert that Shell imports a named function, that a component has moved files, or that two wrappers share source text. Current evidence supports `CHARACTERIZATION READY — NO HONEST STRUCTURAL RED` for B until a duplicated externally visible outcome is reproduced.
