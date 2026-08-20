# Post-refactor Luna gate reconciliation

Issue: #345  
Target: `release/0.1.0-r2`  
Reconciled release SHA: `c047aa7391046dc28efc4d187f8871bb0de4afd2`  
Reconciliation date: 2026-08-18

## Purpose

This is the durable reconciliation ledger for the Luna A/B/C/D post-refactor gate audit. It is governance and testing evidence only. It does **not** implement Product behavior, promote historical `.red` files into the release, remove quarantine, or replace the canonical GitHub Issue/PR graph.

Use this order when the historical audit and current repository disagree:

1. current live GitHub Issue state and accepted dependencies/restoration ownership;
2. current `release/0.1.0-r2` source and permanent test inventory;
3. the post-refactor audit artifacts/summaries;
4. older Luna packet/audit branches as provenance only.

A historical `GREEN`, `ALREADY GREEN`, or merged PR does not close an open Issue. Conversely, a closed Product Issue is not reopened merely because a historical Luna file is absent; missing regression protection gets its own bounded backfill/restoration Issue.

## Audit provenance and remote accessibility

The audit evidence is intentionally **not** merged wholesale from the Luna staging branches.

| Lane | Durable source checked | Current post-refactor status |
|---|---|---|
| A — Desktop/FileManager/Filesystem | `tdd/r2/luna-a-desktop`, exact commit `cea4c002`, `apps/plasmon/test/tdd/luna-a-post-refactor-promotion-audit.md` | Remotely inspectable. Audits current r2 SHA `c047aa7391046dc28efc4d187f8871bb0de4afd2`. |
| B — Shell/Windowing/Taskbar | `tdd/r2/luna-b-shell`, including `apps/plasmon/test/tdd/luna-b-r2-promotion-audit.md` | Historical branch is remotely inspectable; the Coordinator's later post-refactor aggregate/actionable result is durable on #345 and is reconciled below. Do not treat the older `8cfb4d...` classifications as current truth. |
| C — Native Apps/Editors/Games/Media | `tdd/r2/luna-c-apps`, including `apps/plasmon/test/tdd/luna-c-r2-promotion-audit-current.md` | Historical branch is remotely inspectable; the reported post-refactor commit/path was not resolvable from the remote branch during this reconciliation. Its complete actionable post-refactor gaps are reproduced below from the durable #345 Coordinator handoff and checked against current GitHub. |
| D — independent cross-lane audit | `tdd/r2/luna-d-harness-audit`, especially `apps/plasmon/test/tdd/r2-42-entry-promotion-audit.md` | The 42-contract identity/table is remotely inspectable but predates current r2. The reported newer `r2-post-refactor-red-gate-audit.md` is not present on the remote branch; its aggregate result is durable on #345. All 42 contracts are therefore re-reconciled below against current r2/GitHub instead of copying stale classifications. |

Reported post-refactor aggregate summaries on #345:

| Lane | PERMANENT | EQUIVALENT | PACKAGED | QUARANTINED | MISSING | STILL RED | SUPERSEDED |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 10 | 6 | 8 | 2 | 2 | 1 | 4 |
| B | 5 | 10 | 4 | 5 | 2 | 2 | 1 |
| C | 2 | 10 | 10 | 1 | 2 | 1 | 1 |
| D | 15 | 6 | 7 | 3 | 10 | 0 | 1 |

The counts above are provenance, not a second work queue. The tables below are the current action routing authority produced by this reconciliation.

## Current 42-contract Luna-D reconciliation

`Historical D disposition` is copied from the remotely inspectable 42-entry Luna-D audit and is deliberately labeled historical. `Current reconciliation` is based on current `release/0.1.0-r2` plus live GitHub state.

| Contract | Historical D disposition | Current GitHub state | Current reconciliation | Canonical current owner | Why / action |
|---|---|---|---|---|---|
| #44 | ALREADY GREEN | OPEN; PR #346 | **PERMANENT core; remaining visible/package acceptance** | Issue #44 / PR #346 | Keep Product issue open until its remaining visible FileManager acceptance is accepted; no duplicate shortcut authority. |
| #51 | GREEN IN CURRENT R2 | OPEN | **PERMANENT lower-layer coverage; Issue authority still open** | Issue #51 | Current Issue state remains completion authority; do not close from Luna evidence alone. |
| #65 | GREEN IN CURRENT R2 | OPEN | **PERMANENT lower-layer coverage; Issue authority still open** | Issue #65 | Current Issue remains canonical until its acceptance/closure review completes. |
| #66 | BROWSER BOUNDARY | CLOSED Product | **QUARANTINED browser acceptance** | Issue #320 | Product #66 is accepted; exact drag-preview browser debt is owned only by restoration #320. |
| #86 | BROWSER BOUNDARY | CLOSED Product | **QUARANTINED browser acceptance** | Issue #330 | Product #86 is accepted; exact diagnostic-selection browser debt is owned only by restoration #330. |
| #92 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted; no remaining Luna owner. |
| #93 | BROWSER BOUNDARY | OPEN; release-blocker | **STILL RED Product + missing packaged geometry** | Issue #93 | Current r2 still uses `object-fit: cover`; #93 owns both the Product correction and packaged geometry proof. |
| #94 | DEFERRED | OPEN | **SUPERSEDED historical RED; Product work remains** | Issue #94 | Historical packet proposed an invalid/fake media probe without an approved production seam. Do not promote it; live #94 owns the real bounded browser media implementation. |
| #110 | GREEN IN CURRENT R2 (core) | OPEN; release-blocker | **MISSING packaged persistence** | Issue #110 | Core preference semantics exist, but installed toggle/reopen/reload proof remains #110. |
| #115 | NO VALID CORRECTIVE RED | OPEN | **SUPERSEDED historical source-shape RED; Product work remains** | Issue #115 | Do not restore structural/source-shape assertions. Live #115 remains the canonical Product command-convergence scope. |
| #192 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted current placement-controller contract. |
| #195 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted FileManager decomposition contract. |
| #61 | CHARACTERIZATION ONLY | OPEN | **OPEN Product** | Issue #61 | Characterization was not acceptance. #61 remains the canonical Shell overlay-controller work. |
| #63 | INTENTIONAL RED READY | CLOSED Product | **QUARANTINED browser acceptance** | Issue #308 | Product #63 is accepted; the exact Alt-Tab packaged regression is restored only through #308. |
| #72 | ALREADY GREEN | OPEN; release-blocker | **OPEN Product / prerequisite** | Issue #72 | Luna evidence does not override the open Issue; #72 is also the prerequisite for #81. |
| #87 | ALREADY GREEN | OPEN; PR #340; release-blocker | **MISSING migration/provenance acceptance** | Issue #87 / PR #340 | Current post-refactor audit identifies permanent migration/preservation coverage as unresolved; keep it in #87. |
| #91 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Historical RED was consumed by later accepted implementation/evidence. |
| #109 | ALREADY GREEN | OPEN | **OPEN Product / closure authority** | Issue #109 | Do not infer closure from historical green classification. |
| #111 | CHARACTERIZATION ONLY | OPEN | **OPEN Product** | Issue #111 | Shell visual convergence remains a real Product issue; characterization is not completion. |
| #117 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted persistent Windowing placement contract. |
| #118 | GREEN IN CURRENT R2 | CLOSED Product | **QUARANTINED browser acceptance** | Issue #303 | Product grouping behavior is accepted; grouped chooser-title packaged debt belongs only to #303. |
| #119 | DEFERRED | OPEN | **OPEN Product** | Issue #119 | Native transient/dialog ownership remains canonical Product work in #119. |
| #38 | EXTERNAL / COORDINATOR BOUNDARY | OPEN; blocked | **OPEN external/integration evidence** | Issue #38 | Keep fail-closed Sharing boundary; remaining package/backend/Kernel evidence stays in #38. |
| #58 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT / PACKAGED** | none | Standalone Review.neutron MVP accepted; no Luna owner remains. |
| #64 | BLOCKED BY PRODUCT DEPENDENCY | CLOSED | **PERMANENT** | none | Later work resolved the historical dependency; no new owner. |
| #89 | GREEN IN OPEN PR | CLOSED | **PERMANENT / PACKAGED** | none | Historical open-PR statement is stale; Issue #89 is closed. |
| #96 | GREEN IN CURRENT R2 | CLOSED | **PERMANENT** | none | Accepted packaged native identity assets. |
| #112 | ALREADY GREEN | OPEN; release-blocker | **OPEN Product / closure authority** | Issue #112 | Historical green evidence does not override the current open Issue. |
| #113 | HARNESS GAP | CLOSED Product | **MISSING packaged parity protection** | Issue #344 | Do not reopen #113; bounded Text-editor parity backfill is #344. |
| #114 | HARNESS GAP | OPEN; PR #338; release-blocker | **STILL RED Product** | Issue #114 / PR #338 | Markdown formatter/command behavior remains Product work, not a test-only promotion. |
| #123 | BLOCKED BY PRODUCT DEPENDENCY | CLOSED | **PERMANENT / resolved** | none | Historical dependency is resolved and Product issue closed. |
| #124 | BLOCKED BY PRODUCT DEPENDENCY | OPEN; blocked | **QUARANTINED saved-preview acceptance** | Issue #304 | Keep Product #124 open/blocked; exact saved-preview browser readiness/restoration is #304. |
| #78 | ALREADY GREEN | OPEN; blocked | **OPEN composed acceptance** | Issue #78 | Historical equivalence does not close the current cross-surface lifecycle Issue; retain #78 and its real prerequisites. |
| #79 | ALREADY GREEN | CLOSED | **PERMANENT** | none | Accepted native document close lifecycle. |
| #81 | ALREADY GREEN | OPEN; blocked; release-blocker | **MISSING composed taskbar lifecycle** | Issue #81 (blocked by #72) | The post-refactor audit found the composed regression missing; #81 is the sole testing owner. |
| #82 | ALREADY GREEN | CLOSED | **PERMANENT** | none | Accepted managed-root bootstrap regression. |
| #83 | ALREADY GREEN | OPEN | **OPEN acceptance / closure authority** | Issue #83 | Current issue remains open; do not infer completion from historical equivalent coverage. |
| #107 | BROWSER BOUNDARY | OPEN | **OPEN packaged integration acceptance** | Issue #107 | Integrated packaged baseline remains canonical in #107. |
| #25 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Legacy gui2 retirement accepted; historical RED need not be promoted. |
| #26 | INTENTIONAL RED READY | CLOSED | **PERMANENT** | none | Legacy platform compatibility retirement accepted; historical RED need not be promoted. |
| #46 | NO VALID CORRECTIVE RED | CLOSED | **SUPERSEDED / audit-only packet** | none | This was a capability audit; no Plasmon uninstall behavior should be invented without Kernel authority. |
| #100 | INTENTIONAL RED READY | OPEN; blocked; release-blocker | **MISSING metadata migration/verifier** | Issue #100 | Native GitHub dependency mutation/verifier work remains externally constrained and owned only by #100. |

## Post-refactor actionable ownership

These are the post-refactor gaps that still require a current owner. Each acceptance gap has exactly one canonical Product or restoration owner; #345 is not an umbrella implementation owner.

| Finding | Current classification | Canonical owner | Routing |
|---|---|---|---|
| #93 thumbnail aspect/geometry | STILL RED Product + packaged proof | #93 | Current r2 still renders FileManager thumbnails with `object-fit: cover`; fix and package-level geometry proof stay together in the Product Issue. |
| #110 installed hidden-file preference | MISSING packaged acceptance | #110 | Visible toggle + reopen/reload persistence belongs to the existing Product/acceptance Issue. |
| #175 Search geometry | STILL RED | #175 / PR #337 | Finish the Product/browser geometry contract on the existing PR; no test-only clone. |
| #81 composed taskbar lifecycle | MISSING headless composition | #81, gated by #72 | Add the missing Shell/Process/Windowing regression only after the canonical taskbar-state prerequisite is accepted. |
| #66 browser drag preview | QUARANTINED | #320 | Product #66 stays closed; #320 owns repair and five clean first-attempt restoration runs. |
| #86 diagnostic-selection browser acceptance | QUARANTINED | #330 | Product #86 stays closed; #330 owns exact acceptance restoration. |
| #63 Alt-Tab packaged acceptance | QUARANTINED | #308 | Product #63 stays closed; #308 owns the exact Alt-Tab browser restoration. |
| #118 grouped chooser packaged acceptance | QUARANTINED | #303 | Product #118 stays closed; #303 owns chooser-title readiness/restoration. |
| sibling Explorer/window lifetime | QUARANTINED | #251 | Shared sibling creation/readiness flake remains a dedicated CI restoration issue. |
| #43 left snap-preview acceptance | QUARANTINED | #279 | Product #43 stays closed; #279 restores the narrow left-snap browser acceptance. |
| #124 saved-preview acceptance | QUARANTINED/readiness | #304 | Keep #124 Product state separate; #304 owns the flaky blob-preview publication/restoration boundary. |
| #113 Text editor parity protection | MISSING packaged acceptance on closed Product | #344 | Do not reopen #113; #344 is the bounded backfill. |
| #180 denied-fullscreen Photos behavior | MISSING/STILL RED Product + packaged proof | #180 | The installed security-policy behavior and fallback are Product acceptance, not a test-only gate. |
| #114 Markdown formatter/commands | STILL RED Product | #114 / PR #338 | Product implementation and discoverable command acceptance remain together. |
| #100 native dependency metadata/verifier | MISSING integration capability/evidence | #100 | Keep the external GitHub dependency-mutation limitation explicit; do not emulate native dependencies with a new shadow authority. |
| #87 Start-menu migration/provenance | MISSING permanent migration/preservation proof | #87 / PR #340 | The open Product Issue owns the unresolved release-history boundary. |
| TaskManager.sys | Existing Product backlog, not a gate invented by Luna | #184 | #184 remains `r2 or later`; it is not converted into a new audit backfill. |
| Show Desktop | Existing Product backlog, not a gate invented by Luna | #185 | #185 remains `r2 or later`; it is not converted into a new audit backfill. |

No new Issue is created by this reconciliation: every actionable gap above already has a canonical owner.

## Superseded packet rationale

`SUPERSEDED` applies to a historical **packet/gate**, not automatically to the Product Issue with the same number.

| Packet/contract | Rationale |
|---|---|
| #94 historical video-thumbnail RED | The staged packet depended on a fake/unsupported browser-media probe rather than an approved production media seam. It must never be promoted as a permanent regression. The live Product Issue #94 remains open and owns the real bounded media-element/canvas implementation and browser proof. |
| #115 historical source-shape command-layer RED | Source-shape assertions were explicitly rejected as architecture proof and later FileManager decomposition changed the implementation shape. Do not revive that RED. The live Product Issue #115 still owns genuine multi-consumer command convergence. |
| #46 corrective RED concept | #46 was a Kernel capability audit, not a Plasmon behavior implementation. It is closed and must not be converted into a Product uninstall test that invents Kernel authority. |
| #197 Luna-A shell-input handoff | This was a cross-lane dependency/implementation handoff, not an executable Luna-A Product contract. Current Shell tests/Issues own the real behavior; no duplicate gate should be promoted. |
| #201 Luna-A cleanup packet | The packet was dependency-gated cleanup/provenance, not an executable corrective RED. Product cleanup remains owned by #201/PR #339; Luna-A must not duplicate it. |

The later B/C/D summaries each report aggregate `SUPERSEDED` counts, but their exact newer per-row files were not remotely resolvable during this reconciliation. This ledger therefore does not invent an identity from those counts. Every historical packet for which a supersession identity is remotely inspectable is given a concrete rationale above, while every actionable current gap from those summaries is routed to a canonical live Issue in the previous table.

## Required domain spot-checks

### Desktop / FileManager — #93

Current `apps/plasmon/src/os/file-manager/polish.scss` still contains:

```scss
.fm-entry__thumbnail {
  ...
  object-fit: cover;
}
```

Therefore the post-refactor #93 finding is a real Product defect plus missing packaged geometry proof. It is **not** merely a test-promotion gap. Canonical owner: #93.

### Shell / Windowing — #43 packaged snap acceptance

Product #43 is closed with its deterministic snap criteria accepted. The current CI ledger keeps the left-snap browser acceptance quarantined and maps it to restoration #279. This preserves the distinction between accepted Windowing semantics and unstable browser interaction evidence.

### Native Apps — #180

#180 remains open and explicitly requires Photos `Expand` to handle denied browser fullscreen without weakening the Neutron sandbox, provide an in-Plasmon workspace-fill fallback, restore prior view/window state, and prove the real denied-fullscreen environment in packaged browser acceptance. Canonical owner remains #180.

### Metadata / Integration — #100

#100 remains open, blocked, and release-blocking. It owns migration from prose/`blocked` approximations to native GitHub dependencies and requires live dependency direction plus queue-eligibility verification. The limitation is external connector/API capability; it is not permission to create a shadow dependency database.

### Quarantined browser inventory — #295

#295 remains the canonical CI/flaky ledger. Its consolidated quarantine contract maps:
- left snap -> #279;
- right snap -> #244;
- sibling-window lifetime -> #251;
- #63 Alt-Tab -> #308;
- #118 chooser title -> #303;
- EmulatorJS readiness -> #245;
- #66 drag preview -> #320.

#304 separately owns the saved-preview readiness/restoration boundary. Quarantine is not removed by this ledger.

## Worker navigation rules

A train worker can resolve every remaining post-refactor gap without Coordinator chat:

1. start from this ledger or #345;
2. follow the `Canonical current owner` Issue;
3. treat the live Issue state/acceptance criteria as completion authority;
4. for quarantined browser work, also consult #295 and the dedicated restoration Issue;
5. never promote an old `.red` file merely because it contains a once-useful failing assertion;
6. never close an open Product Issue from a Luna `GREEN` classification alone;
7. never reopen a closed Product Issue solely for missing protection when a dedicated backfill/restoration owner exists.

## Reconciliation result

- All 42 Luna-D contract identities have been reconciled against current r2/GitHub.
- Every currently known `MISSING`, `STILL RED`, and `QUARANTINED` post-refactor finding has exactly one canonical open owner.
- No duplicate implementation/backfill Issue was required.
- Current source contradicts the older test-only interpretation of #93; #93 remains Product work.
- Historical packet supersession is kept separate from current Product-Issue state.
- The old Luna staging branches remain provenance only; this file is the durable release-branch reconciliation intended for train workers.
