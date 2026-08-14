# Current post-merge r2 reconciliation audit

Snapshot: 2026-08-14. Release `origin/release/0.1.0-r2` = `82f176a6f11a163197a270a6c2275dde0f95a2e9`.

Merged and refreshed: #51/#210, #65/#208, #173/#212, #189/#207, #190/#211, #191/#204, #192/#205. All queried PR checks were green, including packaged smoke; #173/#190/#191/#192 browser specs are now ordinary release files and have merged-PR CI execution evidence.

## Stale completed dispositions

- **#51, #65:** old queue `RTL RED` labels are stale; both are merged and promotion-accepted.
- **#93:** lower containment is green, but the Issue's decoded packaged visual remainder is not complete; old queue `ALREADY GREEN` overclaims closure.
- **#112:** characterization-ready; no common chrome acceptance proves ALREADY GREEN.
- **#115:** no bounded two-consumer command seam; characterization is useful, ALREADY GREEN is unsupported.
- **#192:** merged controller and tests are green; old queue `HEADLESS RED` is stale, with packaged evidence now recorded.
- **#195:** **not implemented**. Existing characterization/authority guards do not satisfy decomposition acceptance. It must not remain ALREADY GREEN.
- **#79/#83:** current queue says ALREADY GREEN, but no completed composed D packet exists; release those false-green dispositions for explicit ownership review.

## Stale claims

- **#81:** B's published ledger records a stronger equivalent lifecycle regression as green; B/Coordinator should release the claim and mark ALREADY GREEN after evidence verification.
- #92 remains a valid A claim because it consumes the merged #65 vocabulary.
- #61/#111/#119 and C's #64/#113/#114/#123/#124 remain claimed with documented implementation or harness gaps; no competing D work is authorized.

## Promotion state

- **Promoted in release:** #51, #65, #173, #189, #190, #191, #192.
- **Promotion evidence updated:** merged ordinary tests and exact PR CI are recorded in `r2-red-promotion-master-ledger.md`.
- **#190 caveat:** focused installed asset requests are green, but smoke still carries old `/static/plasmon/icons/**` allowances; allowance retirement is pending post-merge verification.
- **#195:** WAITING IMPLEMENTATION; no RED may be weakened into a source-shape guard.

## Browser evidence

Executed in merged PR CI: #173 compact List geometry, #190 installed asset request/response, #191 FileEntry bounds, and #192 placement adapter. #51/#65/#189 use lower truthful layers; no browser proof is required for their core contracts.

Still lacking exact executed browser evidence: #66 drag stacking/hit testing, #86 selection ranges, #93 decoded image geometry, #94 video decode/seek, #110 visible hidden-file reopen/reload, #175 Search geometry, #180 Photos viewport/fullscreen, #202 js-dos sandbox storage, and canonical Monaco worker-path proof for #89/#67/#200. Local browser unavailability remains operational, not a HARNESS GAP.

## Invalid/superseded packets

Implementors must not consume: old one-file #51/#65 packets; old #66 CSS/source stacking gate; old #173 single-column gate; pre-pilot #191 selector/guard variants; old #190 broad health/static-path gate; old #178 cast/API packet; #182 test-local Favorites policy; speculative #92 second operation model; fake #94 decoder proposals; parse-only Playwright scripts. Quarantine authority: `r2-invalid-packet-registry.md` plus Luna-A's invalid index.

## Exact next implementor order after #191

1. **#195** — FileManager decomposition; no implementation currently exists.
2. **#196** — view strategies, after #195 and merged #173.
3. **#176** — context-menu ownership during adapter convergence.
4. **#193** — Search reconstruction after #174 and #175.
5. **#194** — Start reconstruction after #169 and #174.

Do not start #92 before consuming merged #65; do not start #200 before #89/#67/#113 runtime contracts are resolved.

## Ownership / dependency corrections

#38 remains Sharing/Backend/Coordinator-owned; Phase-A provider/storage and fail-closed tests are integrated, while MTN lease-bound import remains unavailable. #78/#82 remain A-facing; #79/#83 require explicit D-owned composed evidence despite stale queue labels; #81 remains B-owned until its claim is released. Merged #173/#190/#191/#192 are no longer implementation blockers.

No product behavior or GitHub Issue state was modified by this audit.
