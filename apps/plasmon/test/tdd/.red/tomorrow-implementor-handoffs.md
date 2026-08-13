# Tomorrow implementor handoffs

## #178 — canonical MIME/language

- **Status:** VERIFIED CORE RED / INCOMPLETE ACCEPTANCE; #189 integrated, ordinary shared derivation API still needs truthful final seam.
- **Prerequisites:** integrated #189 (present); no active #178 PR.
- **Evidence/files:** `issue-178-authority-map.md`, `issue-178-precedence-table.md`, `issue-178-consumer-matrix.md`, `resource-type-duplicate-table-audit.md`.
- **RED target:** inferred extension consumers disagree; do not revive deleted two-argument API.
- **Fence:** FsService/NodeId, classifyResource, AssociationRegistry/OpenService, Visual remain separate authorities.
- **Preserve:** explicit MIME, identity, association/open behavior, unknown safety.
- **Change:** one canonical ordinary derivation consumed by Search/Properties/Text/Markdown.
- **Unspecified:** module names/table representation/exact MIME strings not accepted by current registry.
- **Tests:** Bun/headless first; RTL only for real consumer wiring; browser not required for metadata.
- **Stop:** no cast/fake classifier/test-local table; narrow supported formats to production claims.

## #193 — Search surface

- **Status:** WAIT FOR DEPENDENCY; characterization ready.
- **Prerequisites:** #174, #190, #189, #175 acceptance; no active #193 PR.
- **Evidence/files:** behavior matrix, source uniqueness dataset, preserve/change, surface contract, state machine.
- **RED target:** only after accepted source/projection vocabulary; current Shell state itself is not a RED.
- **Fence:** Search source/activation/Visual/classifier authorities remain canonical.
- **Preserve:** cancellation, limits, categories, activation, focus/dismissal, geometry.
- **Change:** focused surface and explicit states; remove superseded Shell path.
- **Unspecified:** component names, hooks, pixels, line counts.
- **Tests:** Bun model, RTL semantics, Playwright #175/hit/focus only.
- **Stop:** no `.sys`/Visual assumptions from unmerged code.

## #194 — Start surface

- **Status:** WAIT FOR DEPENDENCY on #169.
- **Prerequisites:** accepted reconciliation/boot boundary; no active #194 PR.
- **Evidence/files:** authority map, duplicate audit, preserve/change, state model.
- **Fence:** `/System/Start Menu`, ledger, FsService and canonical opener.
- **Preserve:** user rename/move/delete/customization, NodeIds, activation, errors.
- **Change:** focused filesystem-backed surface; remove Shell lifecycle/JSX after cutover.
- **Unspecified:** controller/API/component/geometry.
- **Tests:** headless tree/reconciliation; RTL navigation; browser focus/containment only.
- **Stop:** never trigger reconciliation from React render as a fake controller.

## #197 — Shell decomposition

- **Status:** CHARACTERIZATION READY — NO HONEST STRUCTURAL RED.
- **Prerequisites:** inventories now; final surface cuts depend on #193/#194 and #176 boundary; no active PR.
- **Evidence/files:** Shell inventory, transient contract, flyout matrix, listener audit.
- **RED target:** active-flyout/dismissal/activation behavior only.
- **Fence:** Shell owns global transient coordination; Process/Windowing/FS/Neutron remain authorities.
- **Preserve:** one flyout, Escape/outside, focus, action outcomes, foreign boundaries.
- **Change:** focused controllers/adapters, remove obsolete state after each cutover.
- **Unspecified:** files/components/line counts.
- **Tests:** pure policy + RTL; Playwright focus/hit/geometry only.
- **Stop:** no Shell2 or global context interceptor.

## #198 / #183 / #118 / #109 — taskbar program

- **Status:** characterization/projection ready; #183 browser spec only; #118 waits for multi-window vocabulary; #109 presentation ready after #190.
- **Prerequisites:** Process/Windowing current contracts; #190 for final asset path; no active future PRs.
- **Evidence/files:** identity truth table, authority audit, projection contract, #183 map, #118 table, #109 map.
- **Fence:** pins=FsService preferences; lifecycle=Process; focus/geometry=Windowing; presentation=Visual.
- **Preserve:** pinned/running/active/minimized/uncertain and close negotiation.
- **Change:** deterministic projection/group/menu/alignment policy.
- **Unspecified:** chooser component, exact menu pixels, alignment schema until accepted.
- **Tests:** Bun projection and close; RTL labels/menus; Playwright source/menu rectangles.
- **Stop:** no second process registry, no grouping of unsupported multi-window semantics.

## #199 / #177 / #43 — native windows

- **Status:** characterization ready; pointer/geometry browser spec only; no active future PR.
- **Prerequisites:** current WindowManager already integrated; no need to wait for other refactors.
- **Evidence/files:** authority map, placement plan, pointer continuity, adapter/chrome contracts.
- **Fence:** WindowManager geometry/focus/snap; Process lifecycle; React is Humble Object.
- **Preserve:** manager state, z/MRU, constraints, pointer cleanup, close negotiation.
- **Change:** separate chrome and browser adapter.
- **Unspecified:** component names/CSS/animation.
- **Tests:** Bun manager/geometry; Playwright capture/rect/snap/resize/focus.
- **Stop:** no NativeWindow2 or React coordinate authority.

## #200 / #89 / #67 — Monaco host

- **Status:** characterization ready; final host waits for #89 path and packaged #67 evidence; no active #200 PR.
- **Evidence/files:** document authority, duplication audit, non-authority list, Program Files boundary, worker failure matrix, #67 contract.
- **Fence:** DocumentSession/FsService/Process outside host; Monaco exact model and worker runtime inside host.
- **Preserve:** save/dirty/conflict/close, model isolation, sandbox.
- **Change:** shared host and explicit runtime states; remove duplicate bootstrap only after migration.
- **Unspecified:** host component/API, retry policy beyond accepted semantics.
- **Tests:** Bun model/worker labels; RTL states; Playwright real workers/editor/package.
- **Stop:** no fake editor readiness, no silent worker fallback/security relaxation.

## #195 / #196 — FileManager

- **Status:** FINALIZE AFTER #191 INTEGRATES; #196 additionally waits #195/#173.
- **Evidence/files:** decomposition readiness v2, preservation map, common-vs-specific, command oracle, responsive corpus.
- **Fence:** FileManager commands/models, FsService/Trash/Association/Open/Visual/NodeId.
- **Preserve:** selection, activation, rename, clipboard, Trash, shortcuts, context, drag/drop, Properties/Open With.
- **Change:** rendered adapters and explicit view strategies.
- **Unspecified:** FileEntry seam until PR #204 inspection; no FileManager2.
- **Tests:** Bun/headless commands/layout; RTL semantics; Playwright real pointer/geometry only.
- **Stop:** do not write final RED under active #191 or assume its unmerged API.

## #201 — cleanup

- **Status:** CLEANUP LATE / RECONNAISSANCE.
- **Prerequisites:** accepted migrations and package/strict-health evidence.
- **Evidence:** expanded `issue-201-cleanup-readiness.md`.
- **Fence:** delete only proven zero-consumer/retired paths.
- **Tests:** import restrictions/tsc/targeted ESLint after evidence; reject decorative dead-code tool.
- **Stop:** textual single-reference is not proof of dead code.
