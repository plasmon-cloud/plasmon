# Issue #193 — preserve/change/unspecified

Status: **WAIT FOR DEPENDENCY** for final packet. #193 has no active PR. The
release at refresh is `f4ac3b4`; #174 and #190 are active today's ownership,
while #189 is not yet integrated in the observed release. This document is
architecture-independent preparation and must not make today's implementations
conform to an unintegrated assumption.

## PRESERVE

- `searchShell` remains the canonical result projection until a replacement
  explicitly consumes its accepted result vocabulary.
- Search categories remain `all`, `apps`, `documents`, `media`, `atoms`.
- `FsNode.id`/NodeId is result identity for filesystem resources; Element/native
  IDs remain distinct and stable.
- Native app opening delegates to `OpenService`/Process; Element opening
  delegates to `NeutronBridge`; filesystem results delegate to
  `activateSearchFilesystemResult` and Association/Open authority.
- Latest-request cancellation, AbortController behavior, bounded warnings,
  total/category limits, and `truncated` semantics.
- Escape, click-away, taskbar toggle, and Search/Start exclusivity.
- Focus and keyboard result activation, after characterization records the
  accepted focus destination.
- #175 stable frame and internal scrolling once geometry is accepted.
- #189 canonical classification, eventual #174 `.sys` projection and #190
  Visual presentation; no local replacements.

## CHANGE

- Shell stops owning the full rendered Search surface/state orchestration.
- A focused Search surface receives an explicit state/result model and renders
  loading, populated, empty, warning/truncated, and error states.
- Deterministic result-state/view-model decisions may move below React with
  Bun tests, while browser event adaptation remains thin.
- Superseded Search JSX/effects/CSS/state are removed after cutover; no permanent
  Search2 or compatibility flag.

## UNSPECIFIED

- Component/module filenames and hook arrangement.
- Exact CSS values, theme tokens, panel dimensions, and pixel baselines.
- Whether state is a class, reducer, store, or controller, provided the tested
  contract and authority boundaries hold.
- Arbitrary line counts, component counts, or Shell source shape.
- A new classifier, presentation registry, activation service, or running-app
  registry.

## Stop conditions

Do not finalize until #174/#190 implementation status and #189 accepted result
vocabulary are inspected on the integrated release. If the canonical harness
cannot render the real composed surface, retain characterization and report a
harness gap rather than mount a fake Search component.
