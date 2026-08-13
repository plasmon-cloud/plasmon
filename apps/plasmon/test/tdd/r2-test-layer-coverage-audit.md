# r2 test-layer coverage audit

## Findings

- **Retain Bun/headless:** filesystem identity, protected roots, classifier precedence, association dispatch, Process/Window lifecycles, Start/Search projection, Trash, placement controller and bootstrap. Browser re-proofs of these policies would be duplication.
- **Retain RTL:** `renderPlasmon()` interactions for actual adapter wiring, accessible commands, keyboard/context/rename, Start/Search/taskbar projection. The integrated 4-test RTL layer proves representative wiring but does not prove every future surface.
- **Keep browser:** #66 stacking/hit testing, #95/#191 geometry, #170 installed Review, #175 panel bounds, #180 viewport behavior, #186 restart, #190 installed assets, Monaco workers and #202 sandbox runtime.
- **Missing lower proof:** #86/#91/#93/#94/#115/#118, and most B/C future Issues. Exact current #51/#65 PR heads now have deterministic helper/model/RTL promotion evidence; their remaining gap is integration, not test-layer coverage.
- **Missing adapter proof:** #173 List, #176 context ownership, #179 autosave preference, #183 taskbar actions and #193/#194 rendered surfaces.
- **Potential duplicate:** #190 deterministic Visual tests are useful, but must not be counted as its installed asset proof. #191 Bun characterization must not be counted as #95 selected-label expansion.
- **Policy smell:** old #182 packet encoded Favorites policy in the test and is quarantined. Old #66 stacking tests that asserted implementation/CSS rather than browser behavior are quarantined.

Recommendation: retain all existing lower guards, add only missing owner-specific assertions in ordinary locations when each implementation lands, and keep browser specs minimal and CI-backed.
