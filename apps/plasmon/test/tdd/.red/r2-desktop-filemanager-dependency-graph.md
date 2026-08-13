# r2 Desktop/FileManager dependency graph — refreshed

Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

```text
#189 (INTEGRATED) ── hard implementation ──> #190 consumer convergence
  ├── closure evidence ──> #178 (ALREADY GREEN on integrated seam)
  ├── consumer prerequisite ──> #174 (active packet; final promotion elsewhere)
  └── consumer prerequisite ──> #193 Search / #194 Start

#171 and #190 ── NO DEPENDENCY / MAY RUN IN PARALLEL
#190 ── no authority dependency ──> Monaco / js-dos / EmulatorJS

#191 ── hard implementation ──> #195 decomposition follow-up
#195 ── hard implementation ──> #196 final view-strategy packet
#173 ── behavior packet / may run in parallel ──> #196 implementation
#195/#196 ── soft product relationship ──> #173

#65 ── hard implementation ──> #92
#44 ── hard consumer dependency ──> #51

#192 (INTEGRATED) ── closure relationship ──> #172
#45 ── no dependency / parallel ──> #172 Trash UI

#176 ── soft consumer relationship ──> Shell/FileManager/native-app adapters
#176 ── no dependency ──> Browser/foreign Neutron iframe content

#169 ── hard implementation ──> #194
#182 ── soft inventory prerequisite ──> #194

#186 ── no dependency / parallel ──> Desktop/FileManager domain refactors
#201 ── closure relationship ──> accepted migrations
```

## Edge status

| Edge | Classification | Current status |
|---|---|---|
| #189 -> #190 | HARD IMPLEMENTATION DEPENDENCY | #189 integrated; PR #211/#190 active, CI currently in progress |
| #189 -> #178 | CLOSURE EVIDENCE | #178 core acceptance is green on integrated release; local TDD staging is stale |
| #189 -> #174 | TEST-PACKET DEPENDENCY | #174 remains active-owned; final consumer promotion waits on its owner |
| #190 -> #52 | SOFT CONSUMER PREFERENCE | presentation convergence, not semantic authority |
| #191 -> #195 | HARD IMPLEMENTATION DEPENDENCY | #191 PR open/not integrated |
| #195 -> #196 | HARD IMPLEMENTATION DEPENDENCY | final #196 packet remains deferred |
| #173 -> #196 | SOFT PRODUCT RELATIONSHIP | #173 behavior is independently specified and can proceed now |
| #65 -> #92 | HARD IMPLEMENTATION DEPENDENCY | PR #208 open, CI green at poll; #92 remains WAIT FOR #65 integration |
| #44 -> #51 | HARD CONSUMER DEPENDENCY | #51 core consumer RED plus primitive fence |
| #192 -> #172 | CLOSURE RELATIONSHIP | #192 integrated in release; composed gate still requires TDD staging refresh |
| #190 / #171 | NO DEPENDENCY / PARALLEL | Plasmon assets versus installed Element assets remain distinct |
| #176 -> surfaces | SOFT CONSUMER RELATIONSHIP | production event-policy seam still missing |
| #186 -> all | NO DEPENDENCY / PARALLEL | #186 is Testing Lead-owned and integrated; no Luna ownership |
| #201 -> migrations | CLOSURE RELATIONSHIP | #192 no longer a wait condition; actual consumers still govern retirement |

## Current order

**Active implementation packets (fenced):** #51, #65, #66, #86, #95, #173,
#174, #182, #190, #191.

**Executable/specification work:** #93, #110, #171, and #172 closure
verification. #178 is already green on integrated source.

**Waiting:** #92 for #65; #195 for #191; #196 for #195; #201 cleanup for
accepted migrations; #94 for a truthful media thumbnail seam.

**Parallel:** #171 browser acceptance, #176 event-policy reconnaissance, #186
Testing Lead, #173 behavior and #190 asset correction can proceed independently
where their respective browser environments are available.
