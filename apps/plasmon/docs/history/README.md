# Plasmon documentation history

This directory preserves release, refactor, acceptance, audit, research, experiment, and other provenance records that are useful for understanding how Plasmon reached its current state.

Material under `docs/history/**` is **historical evidence, not current architecture or contributor authority**. For current behavior, start with [`../README.md`](../README.md), the nearest scoped `README.md` / `AGENTS.md`, current contracts and implementation, and the canonical GitHub Issue when work is still active.

Historical files are intentionally preserved with their original Issue, PR, branch, SHA, lane, release, agent/coordinator, and terminology references. Do not mechanically rewrite those references to match current names. When a historical file contains a rule that still applies, restate the durable rule in current documentation and leave the historical wording intact here.

## Archived records

### Release / acceptance / audit evidence

- [`ACCEPTANCE_2026-08-11_BASELINE_GATE.md`](ACCEPTANCE_2026-08-11_BASELINE_GATE.md) — dated integrated acceptance evidence and subsequent refreshes for the 2026-08 release campaign.
- [`DAEDALOS_PARITY_LEDGER.md`](DAEDALOS_PARITY_LEDGER.md) — dated daedalOS parity/evidence ledger tied to historical integration snapshots and Issue state.
- [`LUNA_POST_REFACTOR_RECONCILIATION.md`](LUNA_POST_REFACTOR_RECONCILIATION.md) — Luna post-refactor reconciliation and ownership-routing evidence.
- [`refactor-issue-191-red-packet.md`](refactor-issue-191-red-packet.md) — Issue #191 refactor/test red packet.
- [`refactor-issue-192-red-packet.md`](refactor-issue-192-red-packet.md) — Issue #192 refactor/test red packet.

### Design / experiment provenance

- [`GUI_EXPERIMENT.md`](GUI_EXPERIMENT.md) — first branch-specific Plasmon desktop GUI experiment.
- [`GUI2_EXPERIMENT.md`](GUI2_EXPERIMENT.md) — second branch-specific desktop GUI experiment.
- [`FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`](FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md) — original cross-subsystem filesystem/Desktop design handoff with its historical implementation sequencing and ownership notes; the current path now contains only the durable architecture contract.
- [`GAMES_DAEDALOS_ARCHITECTURE.md`](GAMES_DAEDALOS_ARCHITECTURE.md) — 2026-08-11 daedalOS games/runtime research and hackathon design handoff.
- [`FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md`](FILESYSTEM_DESKTOP_UX_GAMES_CORRECTION.md) — historical correction packet for the games/runtime portion of the filesystem design; current game/runtime rules live with the Games, Native Apps, filesystem, and runtime documentation.
- [`VISUAL_SYSTEM_THEME.md`](VISUAL_SYSTEM_THEME.md) — historical GUI1 visual-system analysis and design handoff; current visual-system authority lives under `src/os/visual/` and its consumers.
- [`FIRST_COLLABORATIVE_ATOM_DESIGN.md`](FIRST_COLLABORATIVE_ATOM_DESIGN.md) — branch/SHA-bound collaborative Review/Atom research and design exploration.
- [`FIRST_COLLABORATIVE_ATOM_MVP.md`](FIRST_COLLABORATIVE_ATOM_MVP.md) — narrowed hackathon Review/Atom MVP scope and acceptance-design follow-up.

The presence of a record here does not imply that its named Issue, PR, quarantine, CI lane, release branch, package profile, or implementation terminology is still current.
