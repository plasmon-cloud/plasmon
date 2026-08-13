# Issue #194 — Start surface preservation contract

Status: **WAIT FOR DEPENDENCY** — finalize dependency-sensitive portions after
#169 integrates. No #194 implementation PR is open.

## PRESERVE

- `/System/Start Menu` and its NodeId-backed tree remain durable visible
  authority.
- Reconciliation is deterministic/idempotent and preserves renamed, moved,
  deleted, metadata-customized, or content-customized user entries.
- `START_SEEDED_IDENTITIES_KEY` remains migration evidence, not display data.
- Folder navigation uses NodeIds; back returns to the prior folder.
- Actual open delegates to `activateStartFilesystemNode` and canonical
  FilesystemOpenDispatcher/Association/Open authority.
- Native runtime-only definitions are not user-facing Start entries.
- Start/Search/taskbar flyout exclusivity and Shell dismissal remain intact.
- Missing folder, listing error, missing target, and launch failure remain visible
  failures, not silent disappearance.

## CHANGE

- Shell stops owning full Start JSX, list-loading lifecycle, and reconciliation
  orchestration after the accepted #169 boot/controller boundary.
- Focused Start surface renders explicit root/folder/loading/empty/error states.
- Deterministic trail/filter/navigation decisions may move below React with Bun
  tests; DOM focus/pointer adaptation remains RTL/browser work.
- Superseded Start state/effects/JSX/styles are removed after cutover; no Start2
  or second inventory.

## UNSPECIFIED

- future file/component names, hook/reducer choices;
- exact panel geometry/theme and CSS constants;
- whether reconciliation controller is class/function/store;
- arbitrary Shell line/component counts;
- new app catalog or launch dispatcher.

## Finalize-after rule

#169 is today's active ownership. Do not guess its final controller API. After
integration, inspect its accepted boundary and write the final #194 RED against
that actual production vocabulary. Until then this packet is characterization
and readiness, not a claimed executable full RED.
