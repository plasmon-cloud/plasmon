# r2 Desktop/FileManager dependency graph — refreshed

Integrated release at final refresh: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

```text
#189 ── hard implementation ──> #190 consumer convergence
  ├── test-packet ──> #178 (WAIT FOR ACCEPTED #189 SEAM)
  ├── test-packet ──> #174 (core RED; consumer convergence incomplete)
  ├── consumer prerequisite ──> #193 Search
  └── consumer prerequisite ──> #194 Start

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
| #189 -> #190 | HARD IMPLEMENTATION DEPENDENCY | #189 PR open; #190 browser gate repaired, not executed |
| #189 -> #178 | TEST-PACKET DEPENDENCY | #178 correctly WAIT FOR accepted seam; no invented API |
| #189 -> #174 | TEST-PACKET DEPENDENCY | #174 core RED is independently executable; final vocabulary waits |
| #190 -> #52 | SOFT CONSUMER PREFERENCE | presentation convergence, not semantic authority |
| #191 -> #195 | HARD IMPLEMENTATION DEPENDENCY | #191 PR open/not integrated |
| #195 -> #196 | HARD IMPLEMENTATION DEPENDENCY | final #196 packet remains deferred |
| #173 -> #196 | SOFT PRODUCT RELATIONSHIP | #173 behavior is independently specified and can proceed now |
| #65 -> #92 | HARD IMPLEMENTATION DEPENDENCY | PR #208 open/not integrated; #92 WAIT FOR #65 |
| #44 -> #51 | HARD CONSUMER DEPENDENCY | #51 core consumer RED plus primitive fence |
| #192 -> #172 | CLOSURE RELATIONSHIP | #192 integrated; composed real Trash/placement gate staged |
| #190 / #171 | NO DEPENDENCY / PARALLEL | Plasmon assets versus installed Element assets remain distinct |
| #176 -> surfaces | SOFT CONSUMER RELATIONSHIP | production event-policy seam still missing |
| #186 -> all | NO DEPENDENCY / PARALLEL | #186 is Testing Lead-owned and integrated; no Luna ownership |
| #201 -> migrations | CLOSURE RELATIONSHIP | #192 no longer a wait condition; actual consumers still govern retirement |

## Current order

**Implementation-ready packets:** #51, #65, #66, #93, #95, #110, #173,
#174, #182, #190, #172 closure verification.

**Waiting:** #178 for #189; #92 for #65; #195 refresh for #191; #196 for #195;
#201 cleanup for accepted migrations; #94 for truthful media seams.

**Parallel:** #171 browser acceptance, #176 event-policy reconnaissance, #186
Testing Lead, #173 behavior and #190 asset correction can proceed independently
where their respective browser environments are available.
