# Plasmon contributor instructions

## Scope

These instructions apply to `apps/plasmon/**`. Repository-level instructions still apply, and the nearest nested `AGENTS.md` may add narrower rules for a subsystem.

## Read first

1. `apps/plasmon/README.md`.
2. `apps/plasmon/docs/README.md` for the documentation map and repository navigation.
3. `apps/plasmon/TESTING.md`.
4. `apps/plasmon/src/README.md` for frontend/source work.
5. The nearest subsystem README and `AGENTS.md`.
6. Relevant accepted current documents under `apps/plasmon/docs/`.
7. Repository `/doc/` when behavior crosses the Neutron/Kernel boundary.

Use `apps/plasmon/docs/GLOSSARY.md` for shared terminology and identity distinctions. Do not rely on external project sources, chat, old handoffs, old branch snapshots, or superseded release/refactor material as architecture/testing authority when current repository guidance exists. Git history and GitHub own historical provenance; the checked-in documentation tree is current product/contributor authority or a live compatibility contract.

## Source-of-truth order

1. Current explicit task.
2. Nearest applicable `AGENTS.md`.
3. Accepted current architecture/contracts and authoritative repository documentation.
4. Scoped `README.md`.
5. Existing implementation and tests as evidence of current behavior.

If those conflict materially, surface the conflict rather than silently preserving whichever implementation is easiest. External project/chat context may bootstrap navigation, but it does not outrank current repository authority.

## Durable product rules

- Plasmon is the desktop/application environment on Neutron; it is not a replacement Kernel.
- Neutron owns Kernel security, AppScope isolation, capabilities, installation, and execution authority.
- Filesystem semantics come from the filesystem contracts/core. Stable resource identity must not be replaced with path identity.
- Generic resource opening belongs to shared filesystem/association/open services rather than a UI-specific switch statement.
- Native process/window state is Plasmon-local UI/runtime state and must not be conflated with Neutron Element/AppScope state.
- Atom identity is logical application-defined resource identity, not process, window, path, physical app instance, or revision identity.
- Cross-AppScope authorization stays within the accepted MTN/security boundary; application/resource providers retain their own resource semantics.
- Do not create a second implementation stack to avoid integrating with the canonical OS.

Representation-level details and one-off exceptions belong in contracts, tests, or Issues. Do not turn a specific bug fix, filename, suffix, seed item, or temporary compatibility rule into a generic project instruction unless it represents a durable architecture invariant.

## Refactoring direction

When improving existing code:

- move reusable product semantics out of large React components into production models/services/controllers/commands when practical;
- converge duplicate launch, filesystem, preference, metadata, visual, and lifecycle behavior on the owning subsystem;
- migrate useful behavior out of legacy/compatibility trees before deleting them;
- prefer explicit composition through contracts over cross-subsystem imports of private stores or repositories;
- keep demo/fixture/bootstrap content separate from normal durable product initialization;
- use daedalOS to identify missing capabilities and mature interaction patterns, then implement them within Plasmon/Neutron boundaries;
- use Windows/macOS as UX references for discoverability, consistency, keyboard/pointer behavior, and desktop conventions without copying their internal architecture.

Major refactors should become GitHub Issues with problem, scope, acceptance, dependencies, and verification. This file should state the lasting direction, not the active backlog.

## Testing goal

Place tests at the lowest layer that can prove the behavior through production code:

- pure/model/service/controller tests for deterministic semantics;
- integration tests for subsystem composition and contract boundaries;
- browser tests only where real DOM/browser/runtime behavior matters;
- package/installed checks when build output or Neutron packaging is part of the claim;
- manual review for visual polish and interaction quality not meaningfully established by automation.

For **new high-level deterministic workflows that represent legitimate OS operations**, prefer the production semantic API exposed by `createHeadlessPlasmonEnvironment()` as `env.os`. Do not add new raw `environment.services` choreography, legacy `node()/open()/processes()/windows()` helper usage, or Playwright clicks for a workflow that `env.os` can express. Focused subsystem tests should still call their owning model/service/controller/command directly; `OsApi` is not a mandatory wrapper for unit tests. If a legitimate deterministic OS operation is missing from `env.os`, treat that as a candidate production `OsApi` gap before inventing a test-only semantic helper or browser test. See `TESTING.md` and `src/os/api/README.md` for the boundary and exceptions.

Use focused tests while iterating, then run:

```sh
npm --workspace neutron-plasmon test
```

Run package checks when the change affects package/build output:

```sh
npm --workspace neutron-plasmon run test:package
```

Do not use repository-root `npm test` as the normal Plasmon edit loop. See `TESTING.md` for CI and handoff evidence.

A UI regression should get browser coverage only when browser behavior is material; otherwise strengthen the production model/service test instead of reproducing logic in a test-only harness.

## Documentation discipline

README files explain what a directory is, how it fits the product, its public seams, and its current broad implementation shape. `AGENTS.md` files explain durable operational rules: authority, boundaries, refactor direction, testing, and escalation.

Do not use README/AGENTS as an issue tracker. Concrete bugs, temporary migrations, exact one-off acceptance fixes, sprint ownership, release/refactor packets, dated acceptance baselines, old parity ledgers, branch experiments, superseded design handoffs, and other project-management archaeology belong in GitHub/Git history rather than the current documentation tree. A document about an older version remains current only when it is still required to understand or support a live compatibility, migration, schema, package, persistence, or protocol contract.

Keep implementation, headless verification, packaged/browser verification, and human/manual acceptance as separate claims. Never upgrade one evidence layer merely because another passed, and never count an open implementation PR as integrated behavior. Current work/acceptance ownership lives in canonical GitHub Issues and current executable inventories rather than a historical ledger.

Durable discoveries must be committed back to the appropriate current repository documentation, test, contract, or implementation. If a lasting rule is discovered while reviewing historical Git/GitHub evidence, restate it in its current owner before relying on that evidence. Do not leave information needed by future implementers only in chat, external project context, an agent handoff, or history.

## Escalate instead of assuming

Escalate unverified Neutron capabilities, shared-contract changes, persistent schema changes, security-boundary changes, release/version changes, or contradictions with accepted architecture. Do not invent shims simply to make a local UX path work.
