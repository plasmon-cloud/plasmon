# Issue #92 — dependency wait refreshed

Disposition: **WAIT FOR DEPENDENCY**.

PR #208 is open but not integrated into `release/0.1.0-r2`. Its actual proposed
#65 seam is `FileOperationState` with `FileOperationKind`,
`FileOperationSnapshot`, running/completed/failed status, total/processed/
succeeded/failed item counts, current index/item, partial failures, duplicate
`begin` protection and deterministic completion. It intentionally covers import
per-item progress and paste known-total status only.

Do not finalize #92 against the PR branch or introduce a second operation model.
Once #65 integrates, inspect the accepted API again and add a real drag-move
adapter gate covering multi-item operation identity, selected NodeIds, item
progress, full success, partial failure, refresh/selection reconciliation,
cleanup and duplicate gesture protection. The drag mutation remains
`moveNodesToDirectory`/FsService authority and #66 remains presentation-only.

Current lower-layer drag validation and move semantics are already green; the
missing visible operation lifecycle is not yet a valid #92 RED until its shared
state vocabulary is integrated.
