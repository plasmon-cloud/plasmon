# Markdown / Monaco host non-authority boundary

The shared Monaco browser-runtime host may own: Monaco import and lifecycle,
worker bootstrap/readiness/error, per-surface model ownership, language setup,
editor disposal, and browser editor options.

It must not own: FsService bytes/NodeId, DocumentSession load/save/dirty/conflict,
Process close negotiation, AssociationRegistry/OpenService, Markdown parsing or
DOMPurify sanitization, preview links, Edit/Split/Preview state, formatter
policy, Markdown toolbar semantics, settings persistence, or Program Files
reconciliation. It consumes #89's accepted runtime path and #178's accepted
language metadata. #114 remains the owner of Markdown-specific presentation.

Failure is explicit: a failed worker/editor must be a visible error state and
health failure, not a textarea or `data-editor-ready=true` fake.
