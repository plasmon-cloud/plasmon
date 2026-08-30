# OS integration agent instructions

## Authority

`integration/**` composes public subsystem implementations. It must not become a second policy layer for filesystem, associations, process/windowing, Shell, native apps, or Neutron.

## Rules

- Integrate through public contracts and preserve compatible behavior from all current subsystems; do not replace composition wholesale with stale branch state.
- Hosted filesystem access stays behind the persistent background/RPC boundary; standalone preview may use approved local persistence.
- Association/default/preference persistence must reuse approved authorities rather than new foreground stores.
- Generic opening coordinates resolved handlers/runtimes; do not add filename/application-specific dispatch in composition.
- Fakes are test/preview seams, never proof of a real Kernel or security capability.
- Authorization/security integration must fail safely when the required real service is unavailable.
- Current work routing and ownership come from canonical GitHub Issues/Areas and repository assignment/ownership mechanisms; historical agent/branch handoffs in Git history or dated records are not active assignments.

## Refactor direction

Keep `services.ts` an explicit service graph. Move policy into owning subsystems, remove compatibility adapters once consumers are migrated, and avoid special-case integration branches that become alternate authorities.

## Validation

Use integration tests for service composition and public contracts. Use browser/package tests when the active entrypoint, hosted transport, built assets, workers, or real Kernel interaction are part of the behavior.
