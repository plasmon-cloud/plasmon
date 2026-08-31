# `/triage` metadata workflow

`/triage` is the repository's small metadata bridge for canonical Issues and review-ready PRs. It does not close Issues, merge PRs, choose scheduling assignments, or replace GitHub Development.

## Issue triage

Every triaged Issue has native Type/Desire/Effort/Area, an open milestone, and a development lane. Sprint and agent are added when the work is scheduled/assigned.

```text
/triage type=Bug; desire=High; effort=Low; area=File Manager; milestone=0.1.0-r3; lane=product; sprint=5; agent=2
```

Scheduling labels use a consistent colon-space form:

```text
sprint: 5   lane: product   agent: 2
```

`/triage` recognizes older `sprint-5`, `sprint:5`, `lane:ci`, and `agent-2` forms on an item and replaces scheduling labels with the canonical form while preserving unrelated labels.

## What `Area` means

**Area identifies the primary implementation authority and the part of the repository where the change should generally live.** It is not the development lane, not a user-facing feature category, and not a list of every directory touched by the PR.

Choose the Area that owns the behavior or contains most of the implementation. Tests and documentation that accompany a product change normally keep the product Area. Use `Testing` or `Docs` only when test infrastructure or documentation itself is the primary work. For cross-cutting work, prefer the narrow owning subsystem; use `Integration`, `Contracts`, or `Repo` only when that layer is itself the thing being changed.

| Area | Primary meaning | Code usually lives in |
| --- | --- | --- |
| `Repo` | Repository-wide automation, policy, configuration, or developer tooling | `.github/**`, root scripts/configuration |
| `Contracts` | Shared OS interfaces, identifiers, and subsystem vocabulary | `apps/plasmon/src/os/contracts/**` |
| `OS API` | Stable production semantic OS capability API and its adapter | `apps/plasmon/src/os/api/**` |
| `Filesystem` | Filesystem semantics, persistence, resource policy, Trash, shortcuts, and filesystem operations | `apps/plasmon/src/os/fs/**` |
| `Associations` | Handler matching, defaults, Open With, and association models | `apps/plasmon/src/os/associations/**` |
| `Process` | Plasmon native-process registration and lifecycle | `apps/plasmon/src/os/process/**` |
| `Windowing` | Window state, geometry, focus/z-order, minimize/maximize, and interaction primitives | `apps/plasmon/src/os/windowing/**` |
| `Desktop` | Desktop filesystem presentation and persisted icon/layout behavior | `apps/plasmon/src/os/desktop/**` and Desktop-specific composition/styles |
| `File Manager` | Reusable file-management UI/operations and Explorer-specific file browsing | `apps/plasmon/src/os/file-manager/**`, `apps/plasmon/src/native-apps/explorer/**` |
| `Shell` | Start, Search, taskbar/tray, flyouts, shell preferences, and shell navigation | `apps/plasmon/src/os/shell/**` |
| `Diagnostics` | Canonical diagnostic events, `DiagnosticService`, local sinks, retention, and diagnostic policy | `apps/plasmon/src/os/diagnostics/**` |
| `Sharing` | Sharing provider/storage semantics and sharing authorization orchestration | `apps/plasmon/src/os/sharing/**` |
| `Native Apps` | App-specific behavior that is not owned by another dedicated Area | `apps/plasmon/src/native-apps/**` |
| `Games` | Game catalog/fixtures/artwork and game-runtime integration | `apps/plasmon/src/games/**`, relevant game runtime native apps |
| `Visual` | Shared presentation primitives, resource/app visuals, themes, media, overlays, sizing, and wallpaper presentation | `apps/plasmon/src/os/visual/**` |
| `Neutron` | Plasmon's boundary/adapters to Neutron Kernel capabilities and package/runtime metadata | `apps/plasmon/src/os/neutron/**` |
| `Atoms` | Atom/resource identity or Atom-specific behavior that crosses the filesystem/Kernel boundary | usually `apps/plasmon/src/os/contracts/**`, `apps/plasmon/src/os/fs/**`, and the relevant adapter |
| `Integration` | Composition/wiring between existing subsystem authorities | `apps/plasmon/src/os/integration/**`, OS composition roots |
| `Scripting` | `.cmd`/`.run` parsing, transpilation, command sessions, execution, and scripting runtime integration | `apps/plasmon/src/scripting/**` |
| `Packaging` | Plasmon package profiles, build output, package manifests, packaged assets, and package acceptance | `apps/plasmon/build.ts`, `apps/plasmon/packageProfilePolicy.ts`, `apps/plasmon/neutron.json`, packaging tests/CI |
| `Backend` | Plasmon canister/backend implementation and persistent backend schema behavior | `apps/plasmon/backend/**` |
| `Docs` | Documentation architecture/content when documentation itself is the deliverable | `doc/**`, `apps/plasmon/docs/**`, relevant `README.md`/`AGENTS.md` |
| `Testing` | Test infrastructure, harnesses, fixtures, quarantine/flake tooling, or test policy as the primary deliverable | `apps/plasmon/test/**`, test tooling and applicable CI |

The native GitHub `Area` field must contain the same options accepted by `/triage`.

## PR triage

PRs are never Drafts. Once a PR is open and review-ready, inherit scheduling metadata from the canonical Issue or Issues it intentionally implements:

```text
/triage issues=770
/triage issues=770,771
```

The canonical Issues must share the same milestone and sprint/lane/agent metadata. `/triage` copies that metadata to the PR, preserves unrelated PR labels, and writes one fallback marker per acceptance-scope Issue:

```text
Plasmon-Issue: #770
Plasmon-Issue: #771
```

## Development links

GitHub **Development** links remain the authoritative acceptance scope. Parent, dependency, research, related, and follow-up Issues do not belong there.

GitHub exposes a `createLinkedBranch` GraphQL mutation for creating a branch linked to an Issue; a PR opened from that branch can carry the Development relationship naturally. GitHub does not expose an equivalent mutation for attaching an already-existing PR to an Issue through the Development sidebar. For that case, make the Development link in GitHub's UI. The `Plasmon-Issue:` markers are a tooling fallback, not a substitute for Development.

Issue closure is independent from PR merge. Implementers do not close Issues unless explicitly instructed to do so.
