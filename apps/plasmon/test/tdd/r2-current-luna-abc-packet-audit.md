# Current r2 Luna-A/B/C packet audit

Snapshot: 2026-08-13 21:07 -0400. Integrated release: `origin/release/0.1.0-r2` at `2b6984e96647eae1f3abe5719d3a3782809ceeb9`. Published packet refs: A `6034c8e`, B `5fcdcbc`, C `eeb83f5`. GitHub Issues remain authoritative; no Issue or PR metadata was changed.

Disposition vocabulary below describes the packet/evidence, not GitHub closure state.

## Lane A — Desktop/FileManager/Filesystem

| Issue | Current audit disposition | Evidence / correction |
|---|---|---|
| #44 | **ALREADY GREEN** | Canonical shortcut primitive, NodeId, collision, rename and open coverage are in the current release. Keep the packet as closure evidence; do not create another RED for the #51 consumer. |
| #51 | **PROMOTION ACCEPTED / NOT INTEGRATED** | PR #210 exact-head audit accepted the repaired deterministic helper/RTL contract, but current release does not contain the PR. The old one-file RED remains quarantined; no duplicate gate is needed. |
| #65 | **ALREADY GREEN — stale RED label** | PR #208 is merged in current release `2b6984e`; `operation-state.test.ts` and FileManager operation wiring are present. The old one-file packet is useful provenance only and must not be treated as a current RED. |
| #66 | **BROWSER BOUNDARY** | Real overlap, hit-testing, pointer transparency, Escape cleanup and drop require a browser. Preview-count/domain cleanup portions are already lower-layer concerns; no truthful full migration below Playwright. |
| #86 | **BROWSER BOUNDARY** | Error structure and interaction are lower-layer covered, but inherited CSS and `window.getSelection()` mouse behavior are browser-owned. Local packaged-session unavailability is operational, not product RED. |
| #93 | **CORE GREEN / BROWSER VISUAL REMAINDER** | Containment, aspect policy, fallback and URL lifecycle are covered below Playwright. The real decoded image dimensions/frame geometry remain a packaged visual check. |
| #94 | **SPECIFICATION / MISSING PRODUCT SEAM** | No bounded production video-frame lease/extraction path exists. Do not manufacture a Bun decoder or call this a harness gap; eligibility can move lower after a real seam exists, while codec/seek/cleanup remain browser media acceptance. |
| #110 | **CORE GREEN / BROWSER REMAINDER** | Filesystem preference, hidden filtering and reconstruction are green. Visible toggle/reopen/reload is the remaining packaged journey; no duplicate deterministic RED. |
| #115 | **QUESTIONABLE CHARACTERIZATION — NOT ALREADY GREEN** | Issue acceptance requires a bounded shared command seam used by two real consumers. Current evidence proves delegated outcomes, not that seam/consumer migration. Keep the authority map, but the queue's `ALREADY GREEN` disposition is an overclaim; no source-shape test should be added. |
| #192 | **ALREADY GREEN CORE / BROWSER REMAINDER** | Current release contains `src/os/desktop/issue-192.test.ts`, the reconciliation controller, and packaged `plasmon-desktop-placement-192.spec.ts`. The packet's old RED wording is superseded. Packaged execution remains evidence work where not run. |
| #195 | **QUESTIONABLE CHARACTERIZATION — NOT ALREADY GREEN** | Current `FileManager.tsx` still owns substantial selection/rename/context/drag/marquee/render orchestration. The packet is a valid authority/refactor map, not proof of the Issue's decomposition criteria. Do not create implementation-coupled source-shape RED; queue `ALREADY GREEN` is not supported. |

## Lane B — Shell/Windowing

| Issue | Current audit disposition | Evidence / correction |
|---|---|---|
| #63 | **VALID HEADLESS + RTL RED** | No current Alt-Tab implementation was found in the integrated release; MRU/Windowing remains the authority and the packet's focus/accessibility failures remain actionable. |
| #72 | **ALREADY GREEN** | Current taskbar presentation/process tests cover pinned/running/active/launching/uncertain projection. Keep distinct from lifecycle composition #81. |
| #87 | **ALREADY GREEN** | Current Start migration/reconciliation tests cover retirement, customization, idempotency and stable identity. |
| #91 | **VALID HEADLESS RED** | The refreshed packet tests truthful ordinary-cap versus safety truncation semantics without needing DOM geometry or Playwright. |
| #109 | **ALREADY GREEN; not duplicate #72** | Shared PinIcon identity/state and persistence are distinct from taskbar runtime projection, although both are consumed by taskbar UI. |
| #117 | **VALID HEADLESS RED** | Native placement persistence/recomposition is not present in the release; use the real WindowManager/Fs-backed graph, not a feature-local fake. |
| #118 | **VALID HEADLESS RED** | Multiple native instances remain separate taskbar entries; grouping/chooser semantics are not implemented. |

## Lane C — Native Apps/Runtime

| Issue | Current audit disposition | Evidence / correction |
|---|---|---|
| #58 | **CORE GREEN / PACKAGED BOUNDARY REMAINDER** | Review engine, persistence, portability and vanilla-Neutron package/e2e surfaces are present. Standalone MVP is independent of Sharing #38 and future MTN #125/#127; do not duplicate Review/Sharing REDs. |
| #89 | **VALID HEADLESS RED + BROWSER REMAINDER** | Current build still emits top-level `monaco-workers/*`; the Program Files worker-path packet correctly fails deterministically. Worker HTTP/communication proof remains packaged. |
| #96 | **VALID HEADLESS/PACKAGE RED** | Current release `content-apps.ts` still publishes generated `data:image/svg+xml` glyph icons for six canonical first-party apps. The packet checks metadata/asset behavior rather than arbitrary source layout; retain it. |

## Cross-lane packets already marked complete

- **#25/#26:** still valid RED boundary evidence; current release retains `src/gui2`, `src/platform`, and active legacy imports/references.
- **#46:** capability-boundary audit remains valid/ALREADY GREEN for Plasmon: no app-facing Kernel uninstall capability is exposed, so no fake UI contract is permitted.
- **#100:** previous prose-only audit is superseded by `.red/issue-100.red.test.ts`; current live GraphQL gate is RED for stale closed prerequisites and missing native edges.
- **#107:** still a browser/package boundary, but its baseline must be refreshed against `2b6984e`; deterministic journeys already identified for lower layers must remain there.

## Inventory findings

### Completed packets still useful

#44, #72, #87, #109, #192, #58, #110 core evidence, and #65 after merge remain useful as closure/promotion evidence. Their stale RED labels or old staging wording must not be treated as current failures.

### Obsolete or superseded

The old one-file #51/#65 adoption packets, the pre-integration #192 RED wording, and the prior #100 prose-only audit are superseded. Preserve them as provenance/quarantine records; do not rewrite another lane's valid packet merely for style.

### Duplicate coverage

No duplicate RED should be added for #44/#51 (primitive versus destination consumer), #65/#92 (accepted operation vocabulary versus future move consumer), #72/#81 (pure projection versus composed lifecycle), or #58/#38 (standalone Review versus Sharing provider/authorization). #109 overlaps visually with #72 but asserts a separate shared pin primitive and is not duplicate.

### Browser tests that can move lower

The deterministic portions of #66, #93, #107, and #110 are already represented below Playwright. #58 semantic behavior is below Playwright; only installed vanilla-Neutron/package proof remains. Do not move real selection ranges (#86), overlap/hit-testing (#66), decoded image geometry (#93), codec/seek (#94), worker communication (#89), or installed package health below the browser boundary.

### HARNESS GAP

No new true harness gap was found among the completed A/B/C packets. Browser-session absence is an operational block. #94 is a missing production media seam, not a deficient canonical harness. Existing #185 remains the documented harness gap outside this completed-packet inventory.

## Unclaimed cross-system surface

- **#38:** remains unclaimed in the live queue but Phase-A provider/storage work, backend methods, memory declaration, fail-closed authorization, and sharing tests are already present in the integrated release. It is genuinely cross-system, but no new Plasmon RED should be fabricated. Sharing/Backend/Coordinator should perform package/backend/docs verification and distinguish the implemented Phase-A subset from deferred MTN import/live-sharing.
- **#78:** unclaimed; A owns shortcut/open composition when claimed. D must not create a competing packet.
- **#79:** unclaimed; C owns the native document-close consumer. D must not create a duplicate Process/Windowing fake.
- **#82:** unclaimed; A owns managed-root/bootstrap authority. Existing bootstrap tests are adjacent but no D packet should compete.
- **#83:** unclaimed; C owns runtime/association selection. Existing js-dos and EmulatorJS tests are separate lower evidence, not a composed D packet yet.
- **#81:** claimed by Luna-B; D does not duplicate it.

## Remaining high-risk authority boundaries

1. GitHub native dependency metadata and queue eligibility (#100) remain externally mutable and currently fail the semantic gate.
2. MTN lease-bound provider calls remain unavailable; Sharing import must stay fail-closed.
3. Monaco Program Files packaging/worker loading (#89/#67/#200) remains split between deterministic path policy and installed browser communication.
4. FileManager command/decomposition ownership (#115/#195) lacks an accepted production seam; architecture must not be “proven” with source-shape tests.
5. Legacy `gui2`/`platform` retirement (#25/#26) and remaining unclaimed composed journeys (#78/#79/#82/#83) need owning-lane action.
