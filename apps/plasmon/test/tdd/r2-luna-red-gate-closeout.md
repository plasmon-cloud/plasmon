# r2 LUNA CLOSEOUT BLOCKED

This is an audit checkpoint, **not** a closure certificate. The second-pass deep audit is recorded in `r2-deep-completeness-audit.md`, which expands the universe to 103 Issues and supersedes the original 79-row scope count. The required certificate still cannot truthfully be issued.

## Snapshot

- Luna-D branch: `tdd/r2/luna-d-harness-audit`
- Luna-D HEAD at this audit start: `c29c42be9d452f01d51f5286e50fc8071384c21b`
- integrated release observed at finish: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`
- checkpoint Issues enumerated: **79**; expanded second-pass universe: **103**; unclassified: **0**
- prior checkpoint disposition counts are superseded for these two rows: **#51 and #65 are now PROMOTION ACCEPTED; RED PROMOTION GAP 0 for this bounded audit**
- fast tests: `npm --workspace neutron-plasmon test` → **454 Bun + 4 RTL passed, 0 failed**
- browser: no local packaged session executed; this is an operational browser block

## Blocking gaps

1. **Executed product RED #190:** active PR #211's installed asset gate reached the browser but failed required 200 response evidence for representative icons; its broad smoke also failed on unallowed icon aborts. See `r2-browser-health-allowance-audit-v2.md`.
2. **Promotion audit resolved:** exact heads #208/#65 and #210/#51 are PROMOTION ACCEPTED; see `r2-red-promotion-master-ledger.md` and `r2-active-pr-promotion-audit-v2.md`. They remain unintegrated, so release ancestry is still pending, but no behavioral promotion gap remains.
3. **Active PRs:** #204/#191, #208/#65, #210/#51, #211/#190 are not integrated. Luna-D did not edit or merge them.
5. **Browser proofs pending:** #66, #67/#89/#113/#200, #175, #180, #190, #191, #202 and the packaged portion of #181 require a real installed session/CI result. #187 allowances remain for #190, #175/#193, #67/#200 and #202 (plus the unrelated Kernel iframe warning).
6. **Unresolved packets:** B/C have no published packet tree in this snapshot; A future packets are mixed characterization/readiness and RED. #181 lacks an explicit production opt-in fixture seam and therefore has no honest executable RED yet.
7. **Invalid packets:** #66 fake stacking, #173 old single-column, #178 cast/API, #182 test-local Favorites, old #190/#191 health/selector packets, and old one-file #51/#65 packets are quarantined.
8. **GitHub mismatch:** all 79 Issues were open while many linked implementations are merged and ancestor of release. Coordinator must reconcile Issue closure without treating merge as acceptance.
9. **Ownership collisions:** #109 and #177 have A packet artifacts but B is canonical; #189/#190 versus C runtime consumers and #167/#187 versus domain packets are dependency overlaps, documented in `r2-luna-ownership-consistency.md`.
10. **Merged implementations audited:** #167/#170/#186/#187/#189/#192 and historical #25/#38/#43/#44/#46/#58/#64/#67/#72/#82/#87/#89/#95/#107/#109/#110/#111/#117/#121/#155.

## Required next work

- Coordinator must consume the exact-head PROMOTION ACCEPTED dispositions for #51/#65 after their normal review/merge process; Luna-D must not merge them.
- Merge and verify #190/#191, retiring only their own allowances and preserving #95 as a separate contract.
- Testing/Integration must settle the #181 explicit fixture seam, then D stages the production-backed RED and packaged proof.
- Run the packaged CI/browser lanes for the listed browser specs and update the allowance ledger with actual retirement evidence.
- Coordinator must reconcile the queue/GitHub states using `todoctl` and the packet index.

See the companion ledger files in this directory for issue inventory, reconciliation, promotion, browser, allowance, dependency, ownership, quality, source-of-truth, and closure evidence. Do not create `r2-luna-red-gate-closure.md` as a green certificate until these blockers are resolved.
