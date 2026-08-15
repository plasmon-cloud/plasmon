# Luna-C r2 final TDD dispositions — queue finalization

**Audited release:** `origin/release/0.1.0-r2`

**Exact release SHA:** `8cfb4d68414b271303bd0afefdcac9dc8449c315`

**Scope:** final TDD dispositions for Luna-C-owned queue items #64, #113,
#114, #123, and #124. These are terminal TDD decisions, not product
implementation claims. #38 remains Coordinator-owned. #89 remains an
intentional RED handoff to SOL 1. #96 is GREEN IN R2 after PR #264.

## #64 — NO VALID CORRECTIVE RED / PRODUCT CONTRACT REQUIRED

- **Product owner:** SOL 1.
- **Intentional executable RED:** NO. The current js-dos host exposes only
  `JsDosPlayerHandle.stop()`. It does not expose a supported save/export/import
  or save-result lifecycle, and `JsDosPlayer` deliberately passes `autoSave:
  false`. A guessed js-dos API or fake handle would not test production.
- **Final packet:** `test/tdd/issue-64-progress-persistence-packet.md` and
  `test/tdd/luna-c-current-r2-reaudit-64-113-114-123-124.md`.
- **PRESERVE:** FsService as durability authority; stable NodeId/game-resource
  identity; runtime ownership of engine-specific save mechanics; original game
  bundle authority; normal association/OpenService/process lifecycle.
- **CHANGE:** expose a supported bounded engine save/export/import seam and map
  successful progress to Plasmon-owned durable state through the filesystem,
  including close/reopen restoration.
- **UNSPECIFIED:** save representation, engine API invocation details, schema,
  corruption compatibility, and exact save-resource layout until the shipped
  js-dos 8.4.1 capability is inspected and the owner contract is accepted.
- **Lowest truthful layer:** deterministic adapter/Filesystem lifecycle tests
  only after the seam exists; no current RED is valid. Installed browser proof
  is required for real progress -> close -> reopen -> restore.
- **Browser boundary:** actual js-dos engine save/export/import timing and
  packaged runtime lifecycle.
- **Reopening trigger:** SOL 1 integrates a supported js-dos save result and
  restore input with stable identity and explicit success/failure boundaries.
- **Permanent regression expectation:** deterministic NodeId/artifact mapping,
  save failure/corruption, close/reopen restoration, and installed real-runtime
  progress persistence proof.

## #113 — BROWSER BOUNDARY

- **Product owner:** SOL 1.
- **Dependency:** #89 -> #200 -> #113. #112 is a semantic characterization
  fence, not a generic wrapper dependency.
- **Intentional executable RED:** NO current RTL RED. Canonical Happy DOM
  exposes neither `CSS` nor `CSS.escape`, so real Monaco cannot mount through
  the shared RTL adapter. No CSS polyfill, fake Monaco, or mocked editor is
  acceptable.
- **Final packet:** `test/tdd/issue-113-full-acceptance-matrix.md` and
  `test/tdd/issue-200-monaco-host-final-packet.md`.
- **PRESERVE:** DocumentSession/FsService bytes and NodeId identity; Process
  close negotiation; shared model ownership; accepted #189 language policy;
  Text save/dirty/conflict semantics; shared #112 semantic chrome boundary.
- **CHANGE:** filename/editor title derivation, visible language/config state,
  status and command affordances, minimap/text preview, and desktop-editor
  interaction parity.
- **UNSPECIFIED:** component names, CSS topology, exact menu layout, Monaco
  version, pixel dimensions, and any generic native-app wrapper.
- **Lowest truthful layer:** Bun for title/language/status/config derivation and
  DocumentSession authority; installed Playwright for real Monaco mount,
  cursor/line status, minimap, focus, and command behavior.
- **Browser boundary:** actual Monaco initialization, Worker readiness,
  packaged path, opaque-origin sandbox behavior, and rendered editor commands.
- **HARNESS GAP:** category A only for non-engine RTL mounting in Happy DOM;
  Testing may provide a shared adapter or route the engine-dependent assertions
  to installed Playwright. It must not simulate Monaco.
- **Reopening trigger:** canonical RTL can mount the production non-engine path
  without faking Monaco, or the packaged browser lane is available for the full
  editor journey; reopen if #89/#200 changes the host contract.
- **Permanent regression expectation:** deterministic title/language/config
  tests plus installed Text acceptance that proves real Monaco readiness,
  Worker health, focus, line/cursor state, minimap, visible commands, and
  save/reopen without duplicating DocumentSession policy.

## #114 — BROWSER BOUNDARY

- **Product owner:** SOL 1.
- **Dependency:** #89 -> #200 -> #113 shared affordance contract -> #114.
- **Intentional executable RED:** NO current RTL RED. The same canonical Happy
  DOM/Monaco startup boundary applies. Markdown parser/sanitizer tests are
  already deterministic and green; they are not formatter UI evidence.
- **Final packet:** `test/tdd/issue-114-full-acceptance-matrix.md`,
  `test/tdd/issue-114-command-coverage.md`, and
  `test/tdd/issue-200-monaco-host-final-packet.md`.
- **PRESERVE:** Markdown DocumentSession and NodeId authority; Edit/Split/
  Preview modes; Marked + DOMPurify sanitization; normal dirty/save/conflict/
  close semantics; app-owned preview behavior.
- **CHANGE:** deterministic formatter action/provider and failure state;
  discoverable common Monaco commands; document-aware editor title.
- **UNSPECIFIED:** formatter library/provider choice until accepted by SOL 1,
  menu topology, component names, CSS/pixels, and generic plugin architecture.
- **Lowest truthful layer:** Bun for formatter policy/error and Markdown mode/
  sanitization semantics; installed Playwright for real Monaco command,
  formatter, focus, and split-pane interaction.
- **Browser boundary:** real Monaco/Worker lifecycle, command execution, focus,
  layout, and packaged runtime.
- **HARNESS GAP:** category A only for current RTL Monaco mounting; do not add
  local mocks/polyfills.
- **Reopening trigger:** #113's shared command contract lands and either a
  truthful non-engine RTL adapter or installed browser execution is available.
- **Permanent regression expectation:** deterministic formatter/error/preview
  tests plus installed Markdown Edit/Split/Preview, formatter, command,
  save/reopen, and strict browser-health coverage.

## #123 — NO VALID CORRECTIVE RED / PRODUCT CONTRACT REQUIRED

- **Product owner:** SOL 2. SOL 1 reviews only if the canonical filesystem/
  resource metadata contract changes.
- **Intentional executable RED:** NO. #190's shared
  `resourcePresentationForClassification` seam exists, but no accepted
  game-artwork metadata field, provenance/source authority, stable identity and
  copy policy, package/filesystem envelope, MIME/size limit, or fallback
  contract exists. A RED choosing one would invent product behavior.
- **Final packet:** `test/tdd/issue-123-game-artwork-red-spec.md`,
  `test/tdd/issue-123-artwork-metadata-contract.md`, and
  `test/tdd/luna-c-current-r2-reaudit-64-113-114-123-124.md`.
- **PRESERVE:** FsService/NodeId resource identity; normal association/runtime
  execution; #190 shared Visual/ResourcePresentation authority; deterministic
  fallback; bounded package-local or filesystem-backed resources only.
- **CHANGE:** supported game resources may carry/reference canonical artwork
  metadata and Desktop/FileManager/Search consume the same resolved
  presentation.
- **UNSPECIFIED:** metadata key/byte envelope, provenance format, rename/copy
  semantics, package-vs-filesystem source, size/MIME policy, and legal fixture
  representation.
- **Lowest truthful layer:** deterministic metadata/classification/presentation
  tests after the contract integrates; bounded package/manual visual proof for
  actual assets. No filename-table or source-shape RED.
- **Browser boundary:** packaged asset resolution and visual/manual acceptance,
  after the product contract exists.
- **Reopening trigger:** SOL 2 integrates an accepted metadata contract through
  #189/#190 with a stable fixture/resource authority.
- **Permanent regression expectation:** metadata-to-shared-presentation,
  rename/copy identity, invalid/missing fallback, package/offline asset, and
  representative Desktop/FileManager/Search coverage.

## #124 — BLOCKED BY PRODUCT DEPENDENCY: #64

- **Product owner:** SOL 1 after #64.
- **Intentional executable RED:** NO. A screenshot test would need to invent
  the authoritative save resource, successful save boundary, and preview
  association that #64 has not defined.
- **Final packet:** `test/tdd/issue-124-save-screenshot-red-spec.md`,
  `test/tdd/issue-124-preview-authority-contract.md`, and
  `test/tdd/luna-c-current-r2-reaudit-64-113-114-123-124.md`.
- **PRESERVE:** save bytes/state remain authoritative independently of preview;
  stable save/resource identity; shared resource presentation; normal runtime
  and filesystem lifecycle; save success must not depend on screenshot success.
- **CHANGE:** a supported runtime may produce bounded screenshot metadata/bytes
  at an explicit successful save/snapshot boundary, associated with the stable
  save resource and rendered through shared presentation/fallback.
- **UNSPECIFIED:** screenshot schema, capture API, image encoding/size, storage
  layout, replacement/cleanup policy, and which runtime fixtures support capture.
- **Lowest truthful layer:** deterministic save/preview association and failure
  tests after #64; installed browser for real runtime frame capture, persistence,
  reopen, cleanup, and package presentation.
- **Browser boundary:** actual emulator canvas/frame capture and packaged runtime.
- **Reopening trigger:** #64 lands an accepted stable save-resource
  representation plus explicit successful save boundary and a supported runtime
  capture result.
- **Permanent regression expectation:** save survives missing/failed capture;
  preview is bounded/non-authoritative; stable identity survives reopen; shared
  presentation/fallback and cleanup are covered in deterministic and installed
  acceptance.

## Final queue rule

These five items now have terminal TDD dispositions and must be marked `[x]` in
the shared queue. Finalization does not claim product implementation. #64,
#123, and #124 are explicit product/dependency blockers; #113/#114 are explicit
browser boundaries with a category-A shared RTL gap. No Luna-local production
mock, CSS polyfill, guessed runtime API, or speculative schema is authorized.
