# Luna-C tomorrow implementor handoffs

## 1. #179 — autosave default OFF (highest independent deterministic value)

- **Prerequisites:** #41/#42 integrated; shared `DocumentSession`; accepted
  settings persistence decision.
- **RED files:** `issue-179-preserve-change-unspecified.md`,
  `issue-179-save-state-machine.md`, `.red/issue-179.red.test.ts`.
- **Intended failure:** after edit and debounce, Text/Markdown bytes remain
  unchanged, session remains dirty; current forced timer writes and fails.
- **PRESERVE:** FS/NodeId, explicit save/conflict/dirty-close, Monaco model.
- **CHANGE:** default OFF and shared opt-in policy.
- **UNSPECIFIED:** UI location, exact debounce, API names.
- **Boundaries:** no Text-local FS or localStorage; no host policy.
- **Browser:** RTL only for preference/affordances; Monaco browser not needed.
- **Security:** no sandbox change.
- **GREEN destination:** `text/document.test.ts` shared session tests plus a
  bounded RTL preference test.
- **Unrelated allowances:** none.
- **Stop:** all default-off and failure/close cases pass without model reset.

## 2. #67/#89 — Monaco installed worker path/health

Prerequisites: #89 accepted path, #200 host contract, #187 health. Use the
worker observability packet and browser-health contract. Preserve sandbox/CSP,
change only path/bootstrap, and target permanent `test/e2e` installed tests.
Stop if evidence is only visible editor DOM or HTTP success.

## 3. #113/#114 — editor chrome/formatter

Prerequisites: #178 and #200 contracts; #112 common chrome characterization.
Use acceptance matrices. Preserve document/session and preview sanitization;
change only app UX. Bun/RTL first, packaged browser for real Monaco commands.

## 4. #180 — Photos fallback

Prerequisite: installed denied-fullscreen environment. Use capability state and
packaged spec. Preserve sandbox and Windowing; target a permanent packaged gate
plus existing helper tests. Stop on any permission/security relaxation.

## 5. #202 — blocked handoff

No implementation owner during active refactor. Use the four #202 documents as
validation only. Future owner must remove only the two exact #202 allowances and
prove local-assets-only real readiness.

## order rationale

#179 is deterministic and independent; #89/#67 have highest architectural
leverage but depend on #200/path decisions and browser availability; #113/#114
follow the shared host; #180 is independent but browser-bound; #202 is last and
blocked. #121/#48/#64 closure evidence and #122 research can proceed without
product changes. #123 follows #190/#121 and #124 waits for #64.
