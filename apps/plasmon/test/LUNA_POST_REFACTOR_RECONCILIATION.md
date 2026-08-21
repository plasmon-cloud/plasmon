# Post-refactor Luna gate reconciliation

Issue: #345  
Target: `release/0.1.0-r2`  
Revalidated release SHA: `a8b7f806a2ded7d037b5d6d7fc355ddaf5e170ad`  
Original merged reconciliation: PR #349 / merge `028aca8c6fbe2eda446ba0b7932129adf8e14e14`  
Revalidation date: 2026-08-20 UTC

## Purpose

This is the durable worker-facing reconciliation ledger for the Luna A/B/C/D post-refactor gate audit. It is governance and testing evidence only. It does **not** implement Product behavior, promote historical `.red` files into the release, remove quarantine, replace the canonical GitHub Issue/PR graph, or implement the full-corpus manifest/verifier owned by #368.

Use this order when historical audit material and current repository state disagree:

1. the live canonical GitHub Issue and its acceptance/closure evidence;
2. current `release/0.1.0-r2` source and required test/quarantine inventories;
3. this reconciliation;
4. the historical Luna audit branches as provenance.

A historical `GREEN`, `ALREADY GREEN`, or merged PR does not close an open Issue. A closed Product Issue is not reopened merely because a historical Luna file is absent; missing regression protection uses a bounded testing/restoration owner.

## Audit provenance and remote accessibility

The historical staging branches remain remotely inspectable provenance and are intentionally not merged wholesale into r2.

| Lane | Durable remote source | Relationship to current r2 |
|---|---|---|
| A — Desktop/FileManager/Filesystem | `tdd/r2/luna-a-desktop` → `apps/plasmon/test/tdd/luna-a-post-refactor-promotion-audit.md`, audited at `c047aa7391046dc28efc4d187f8871bb0de4afd2` | Exact post-refactor artifact is remotely inspectable; current routing is revalidated below. |
| B — Shell/Windowing/Taskbar | `tdd/r2/luna-b-shell` → `apps/plasmon/test/tdd/luna-b-r2-promotion-audit.md`, audited at `8cfb4d68414b271303bd0afefdcac9dc8449c315` | Historical classifications are provenance; later #345 reconciliation and live Issue state win. |
| C — Native Apps/Editors/Games/Media | `tdd/r2/luna-c-apps` → `apps/plasmon/test/tdd/luna-c-r2-promotion-audit-current.md`, audited at `8cfb4d68414b271303bd0afefdcac9dc8449c315` | Historical classifications are provenance; later #345 reconciliation and live Issue state win. |
| D — independent cross-lane audit | `tdd/r2/luna-d-harness-audit` → `apps/plasmon/test/tdd/r2-42-entry-promotion-audit.md`, audited at `8cfb4d68414b271303bd0afefdcac9dc8449c315` | The 42 contract identities are preserved below and revalidated against current r2/GitHub. |

The later lane summaries reproduced on #345 remain useful audit provenance, but their aggregate counts are not a second work queue. #368 owns the canonical checked-in normalized 128-entry A/B/C/D manifest and verifier; #369 owns final exact-SHA certification.

## Corrections since the original #349 reconciliation

The original ledger was correct for its inspection point but became stale as r2 advanced.

- #114 is now **closed satisfied** with its formatter, visible Monaco commands, title identity, deterministic tests, and packaged browser acceptance integrated. Its Luna contract is terminal packaged evidence, not `STILL RED`.
- #175 is now **closed satisfied** with stable Search geometry and required packaged browser coverage. It no longer needs a current Luna owner.
- #194 is now **closed satisfied**. It must not remain in the current nonterminal full-corpus owner set.
- #124 remains open Product work, but it is no longer blocked by #64; its saved-preview browser acceptance is still quarantined only through #304.
- #305 is terminal **PERMANENT policy evidence**, not an active test quarantine. The active required-browser quarantine inventory contains exactly seven test acceptances owned by #279, #251, #308, #303, #304, #320, and #330.
- #93 remains genuine open Product/acceptance work. Current r2 still contains the obsolete FileManager-local `.fm-entry__thumbnail { object-fit: cover; }` rule while PR #357 is open/draft; #93 remains the sole Product owner rather than becoming a test-only backfill.

## Current 42-contract Luna-D reconciliation

`Historical D disposition` is provenance from the remotely inspectable D42 audit. `Current reconciliation` is revalidated against current r2 plus live GitHub state.

| Contract | Historical D disposition | Current GitHub state | Current reconciliation | Canonical current owner | Why / action |
|---|---|---|---|---|---|
| #44 | ALREADY GREEN | OPEN; PR #346 | **PERMANENT core; remaining visible/package acceptance** | #44 / PR #346 | Keep the Product Issue authoritative until its remaining acceptance closes. |
| #51 | GREEN IN CURRENT R2 | OPEN; PR #358 | **PERMANENT lower-layer coverage; Issue authority still open** | #51 / PR #358 | Historical green does not close the live Issue. |
| #65 | GREEN IN CURRENT R2 | OPEN | **PERMANENT lower-layer coverage; Issue authority still open** | #65 | Live Issue remains completion authority. |
| #66 | BROWSER BOUNDARY | CLOSED Product | **QUARANTINED browser acceptance** | #320 | Product is accepted; only #320 owns the excluded browser acceptance. |
| #86 | BROWSER BOUNDARY | CLOSED Product | **QUARANTINED browser acceptance** | #330 | Product is accepted; only #330 owns the excluded browser acceptance. |
| #92 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted; no remaining Luna owner. |
| #93 | BROWSER BOUNDARY | OPEN; PR #357; release-blocker | **STILL RED Product + missing packaged geometry** | #93 / PR #357 | Current target still carries obsolete crop CSS; the open Product Issue owns correction and packaged proof. |
| #94 | DEFERRED | OPEN | **SUPERSEDED historical RED; Product work remains** | #94 | Do not promote the unsupported historical media probe; live Product scope remains #94. |
| #110 | GREEN IN CURRENT R2 (core) | OPEN; PR #352; release-blocker | **MISSING packaged persistence** | #110 / PR #352 | Core preference semantics exist; installed toggle/reopen/reload proof remains nonterminal. |
| #115 | NO VALID CORRECTIVE RED | OPEN | **SUPERSEDED historical source-shape RED; Product work remains** | #115 | Do not restore structural source-shape assertions; live command convergence remains Product work. |
| #192 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted placement-controller contract. |
| #195 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted FileManager decomposition contract. |
| #61 | CHARACTERIZATION ONLY | OPEN | **OPEN Product** | #61 | Characterization was not acceptance. |
| #63 | INTENTIONAL RED READY | CLOSED Product | **QUARANTINED browser acceptance** | #308 | Product is accepted; #308 owns the exact Alt-Tab packaged restoration. |
| #72 | ALREADY GREEN | OPEN; PR #351; release-blocker | **OPEN Product / prerequisite** | #72 / PR #351 | Live Issue remains authoritative and is the prerequisite for #81. |
| #87 | ALREADY GREEN | OPEN; PR #340; release-blocker | **MISSING migration/provenance acceptance** | #87 / PR #340 | Permanent migration/preservation evidence remains unresolved here. |
| #91 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Historical RED was consumed by accepted implementation/evidence. |
| #109 | ALREADY GREEN | OPEN | **OPEN Product / closure authority** | #109 | Historical green does not override the open Issue. |
| #111 | CHARACTERIZATION ONLY | OPEN | **OPEN Product** | #111 | Characterization is not completion of Shell visual convergence. |
| #117 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted Windowing placement contract. |
| #118 | GREEN IN CURRENT R2 | CLOSED Product | **QUARANTINED browser acceptance** | #303 | Product is accepted; #303 owns the chooser-title browser restoration. |
| #119 | DEFERRED | OPEN | **OPEN Product** | #119 | Native transient/dialog ownership remains canonical Product work. |
| #38 | EXTERNAL / COORDINATOR BOUNDARY | OPEN; blocked | **OPEN external/integration evidence** | #38 | Keep the fail-closed Sharing boundary; do not invent Kernel authority. |
| #58 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT / PACKAGED** | none | Accepted standalone Review.neutron evidence. |
| #64 | BLOCKED BY PRODUCT DEPENDENCY | CLOSED | **PERMANENT** | none | Historical dependency is resolved. |
| #89 | GREEN IN OPEN PR | CLOSED | **PERMANENT / PACKAGED** | none | Historical open-PR wording is stale; Product Issue is closed. |
| #96 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted native identity assets. |
| #112 | ALREADY GREEN | OPEN; PR #356; release-blocker | **OPEN Product / closure authority** | #112 / PR #356 | Historical green does not override the live Issue. |
| #113 | HARNESS GAP | CLOSED Product | **MISSING packaged parity protection** | #344 / PR #355 | Do not reopen #113; bounded Text parity protection is #344. |
| #114 | HARNESS GAP | CLOSED satisfied | **PACKAGED / accepted** | none | Current r2 integrates formatter/command/title behavior and the installed browser proof; the earlier `STILL RED` classification is superseded. |
| #123 | BLOCKED BY PRODUCT DEPENDENCY | CLOSED | **PERMANENT / resolved** | none | Historical dependency is resolved. |
| #124 | BLOCKED BY PRODUCT DEPENDENCY | OPEN | **OPEN Product + QUARANTINED saved-preview acceptance** | Product #124; restoration #304 | #64 is closed, so Product is no longer dependency-blocked; #304 alone owns the excluded saved-preview browser gate. |
| #78 | ALREADY GREEN | OPEN; blocked; `ci:flaky` | **OPEN composed acceptance** | #78 | Historical equivalence does not close the current cross-surface lifecycle Issue. |
| #79 | ALREADY GREEN | CLOSED | **PERMANENT** | none | Accepted native document close lifecycle. |
| #81 | ALREADY GREEN | OPEN; blocked; release-blocker | **MISSING composed taskbar lifecycle** | #81 (prerequisite #72) | The composed Shell/Process/Windowing regression remains the sole #81 testing obligation. |
| #82 | ALREADY GREEN | CLOSED | **PERMANENT** | none | Accepted managed-root bootstrap regression. |
| #83 | ALREADY GREEN | OPEN; `ci:flaky` | **OPEN acceptance / closure authority** | #83 | Historical equivalent coverage does not close the live Issue. |
| #107 | BROWSER BOUNDARY | OPEN | **OPEN packaged integration acceptance** | #107 | Integrated packaged baseline remains canonical here. |
| #25 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Legacy gui2 retirement accepted. |
| #26 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Legacy platform compatibility retirement accepted. |
| #46 | NO VALID CORRECTIVE RED | CLOSED | **SUPERSEDED / audit-only packet** | none | Capability audit must not be converted into invented Plasmon uninstall behavior. |
| #100 | INTENTIONAL RED READY | OPEN; blocked; release-blocker | **MISSING metadata migration/verifier** | #100 | Native GitHub dependency metadata/validator work remains solely owned here. |

## Current actionable routing

These are the post-refactor r2 gaps that still require a canonical owner. #345 does not implement any of them.

| Finding | Current classification | Canonical owner | Routing |
|---|---|---|---|
| #93 thumbnail aspect/geometry | STILL RED Product + packaged proof | #93 / PR #357 | Product correction and installed geometry/fallback proof stay together. |
| #110 installed hidden-file preference | MISSING packaged acceptance | #110 / PR #352 | Visible toggle plus reopen/reload persistence remain with the existing Issue. |
| #81 composed taskbar lifecycle | MISSING headless composition | #81, gated by #72 | Keep the composed Shell/Process/Windowing regression with its canonical prerequisite. |
| #66 browser drag preview | QUARANTINED | #320 | Product #66 remains closed; #320 restores the exact acceptance. |
| #86 diagnostic-selection browser acceptance | QUARANTINED | #330 | Product #86 remains closed; #330 restores the exact acceptance. |
| #63 Alt-Tab packaged acceptance | QUARANTINED | #308 | Product #63 remains closed; #308 restores the exact browser acceptance. |
| #118 grouped chooser packaged acceptance | QUARANTINED | #303 | Product #118 remains closed; #303 owns chooser-title readiness/restoration. |
| sibling Explorer/window lifetime | QUARANTINED | #251 | Shared second-Explorer lifetime readiness stays in its dedicated restoration Issue. |
| #43 left snap-preview acceptance | QUARANTINED | #279 | Product #43 remains closed; #279 restores the narrow left-snap gate. |
| #124 saved-preview acceptance | QUARANTINED | #304 | Product #124 stays separate; #304 owns blob-preview browser restoration. |
| #113 Text editor parity protection | MISSING packaged protection on closed Product | #344 / PR #355 | Do not reopen #113. |
| #180 denied-fullscreen Photos behavior | nonterminal Product + packaged proof | #180 / PR #354 | Security-policy fallback and installed proof stay in the Product Issue. |
| #100 native dependency metadata/verifier | MISSING integration capability/evidence | #100 | Do not replace native GitHub dependency authority with a shadow database. |
| #87 Start-menu migration/provenance | MISSING permanent migration/preservation proof | #87 / PR #340 | Existing Issue owns the release-history boundary. |
| #366 native `.sys` Search protection | MISSING bounded regression owner created by reconciliation | #366 | Closed #174 is not reopened; #366 owns exactly-one projection/identity/activation regression proof. |
| #367 user-directory deletion persistence | MISSING bounded regression owner created by reconciliation | #367 | Closed #182 is not reopened; #367 owns non-resurrection across recomposition. |

Recently terminal findings must not remain in the nonterminal routing set:

- #114 — closed satisfied; current installed Markdown formatter/command acceptance is terminal evidence.
- #175 — closed satisfied; current required Search-geometry packaged acceptance is terminal evidence.
- #194 — closed satisfied; Start reconstruction is no longer a current full-corpus pending owner.
- #305 — closed; exact BrowserHealth warning policy is PERMANENT evidence, not an active quarantine.

## Current required-browser quarantine inventory

The canonical `test/ci/QUARANTINED_BROWSER_TESTS.md` currently contains exactly seven active `@r2-quarantine` acceptances:

| Acceptance | Restoration owner |
|---|---|
| shared left-snap preview | #279 |
| Explorer sibling lifetime | #251 |
| #63 Alt-Tab multi-instance setup | #308 |
| #118 grouped Explorer chooser-title readiness | #303 |
| #124 saved-preview blob readiness | #304 |
| #66 drag-preview / directory-drop completion | #320 |
| #86 diagnostic-selection / New Folder readiness | #330 |

#244 right-snap and #245 EmulatorJS readiness have already returned to required Specialist execution and are not active quarantines. #305 is a narrow BrowserHealth policy exception with terminal reviewed evidence, not a skipped/quarantined test.

## Superseded packet rationale and full-corpus handoff

`SUPERSEDED` applies to a historical packet/gate, not automatically to the Product Issue sharing its number.

The original reconciliation established concrete non-promotion rationale for remotely identifiable examples including #94, #115, #46, the #197 Luna-A handoff, and the #201 Luna-A cleanup packet. Later #345 corpus reconciliation identified additional intentionally removed/invalid/audit packet identities and corrected the normalized full corpus to **N=128**.

#345 remains the ownership-routing authority. It does not duplicate the next bounded governance work:

- #368 owns the canonical checked-in 128-entry manifest, including stable gate IDs, all 28 superseded identities/rationales, evidence paths, owner/rationale fields, required CI reachability, and the deterministic verifier.
- #369 owns independent final exact-SHA certification after current-r2 child owners are terminal.

Until #368 lands, do not treat the historical aggregate counts or this routing ledger as a substitute for the canonical full-corpus manifest.

## Required domain spot-checks at current r2

### Desktop / FileManager — #93

Current target `apps/plasmon/src/os/file-manager/polish.scss` still contains the obsolete local thumbnail block with `object-fit: cover`. PR #357 explicitly removes that obsolete rule and adds packaged aspect/fallback proof, but it remains open/draft. #93 therefore remains genuine Product/acceptance work, not a test-only promotion gap.

### Shell / Windowing — #175 and active snap quarantine

#175 is closed satisfied after the accepted Search-geometry implementation and required packaged browser proof. Separately, Product #43 remains closed while the exact left-snap browser acceptance remains quarantined through #279. Do not conflate accepted Product semantics with browser-gate restoration.

### Native Apps — #114 and #180

#114 is closed satisfied with the Markdown formatter/title/command implementation plus installed browser proof. #180 remains open with PR #354 and still owns denied-fullscreen Photos fallback/packaged acceptance.

### Metadata / Integration — #100

#100 remains open, blocked, and release-blocking. Native GitHub dependency metadata/validation remains the authority; this reconciliation does not introduce a substitute queue or shadow dependency representation.

### Quarantined browser inventory

The canonical quarantine inventory lists seven active test-level quarantines and their dedicated owners: #279, #251, #308, #303, #304, #320, and #330. #244 and #245 are required again; #305 is terminal policy evidence.

## Worker navigation rules

A train worker can resolve remaining post-refactor work without Coordinator chat:

1. start from this ledger or #345;
2. follow the `Canonical current owner` Issue;
3. treat the live Issue acceptance/closure evidence as completion authority;
4. for quarantined browser work, also consult `test/ci/QUARANTINED_BROWSER_TESTS.md`, #295, and the dedicated restoration Issue;
5. never promote an old `.red` file merely because it contains a once-useful failing assertion;
6. never close an open Product Issue from a Luna `GREEN` classification alone;
7. never reopen a closed Product Issue solely for missing protection when a dedicated backfill/restoration owner exists;
8. use #368 for canonical full-corpus manifest/verifier state and #369 for final certification rather than extending this ledger into either scope.

## Reconciliation result

At exact r2 SHA `a8b7f806a2ded7d037b5d6d7fc355ddaf5e170ad`:

- all 42 Luna-D contract identities remain explicitly reconciled against current r2/GitHub;
- every current `MISSING`, Product-nonterminal, and active `QUARANTINED` finding represented here routes to a canonical Issue/restoration owner;
- #114, #175, #194, and #305 are corrected to their current terminal dispositions rather than preserving stale audit state;
- the active browser-quarantine set matches the repository quarantine inventory exactly;
- historical packet provenance remains separate from current Product-Issue state;
- the full 128-entry canonical manifest/verifier and all superseded stable IDs/rationales remain explicitly owned by #368, with final certification owned by #369.
