# r2 permanent test-location audit

| class | appropriate destination | observed state |
|---|---|---|
| pure authority/model | `src/**.test.ts(x)` | many integrated guards are correctly here (#44, #72, #82, #87, #110, #189, #192) |
| production composition/headless | `apps/plasmon/test/*.test.ts` | `headlessEnvironment`, cross-surface, refactor, persistence-adjacent guards are ordinary and discovered |
| RTL adapter | `apps/plasmon/test/rtl/*.test.tsx` | shared renderer and refactor smoke are ordinary; active #51/#65/#191 PR tests are ordinary on their PR branches |
| browser/package | repository `test/e2e/*.spec.ts` + CI | #186 and #187 are integrated; #190/#191 are active branches; #175/#202 remain specs/allowances |
| documentation only | `test/README`, TESTING, REFACTOR_GUARDS | authority and boundary contracts are durable docs |
| Luna staging | `apps/plasmon/test/tdd/.red/**` | intentionally excluded from ordinary discovery; not release protection |

Flags: #51 and #65 are **GREEN TEST COPIED BUT WEAKENED** relative to the final A packet; #190 and #191 are **WAITING MERGE** rather than release tests; unresolved future gates are **GREEN ONLY ON LUNA BRANCH** or not green at all. No duplicate slow proof was added by Luna-D. Playwright is retained only for installed/runtime/geometry boundaries; deterministic classification, identity, process, and projection tests remain below it.
