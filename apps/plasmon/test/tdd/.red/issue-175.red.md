# Issue #175 — Search stable geometry packet

Classification: **BROWSER SPEC ONLY**. No browser execution was available on
this lane because the local packaged Neutron session is absent. This packet is
not verified by Playwright and does not claim arbitrary fixed CSS dimensions.

## Canonical requirement -> authority -> observable -> layer -> evidence -> gap

| Requirement | Authority | Observable behavior | Layer | Existing evidence | Missing evidence |
|---|---|---|---|---|---|
| frame stable across categories | Search surface + shell viewport layout | outer Search region rect remains stable while Apps/Documents/Media/Atoms switch | Playwright | current Shell has one panel and category filter | executed fixed-viewport browser run |
| controls anchored | rendered tab/input controls | input and tab-group x/y/width do not substantially move | Playwright | no geometry test | executed geometry comparison |
| sparse/empty body stable | Search surface state model | no-result category retains frame and result region | RTL for state; Playwright for frame | source emits “No results in this category.” | explicit empty-state render + browser rects |
| large results scroll internally | result region | `scrollHeight > clientHeight` while outer frame remains viewport-contained | Playwright | CSS currently gives result region `max-height: 48vh; overflow:auto` | real populated result corpus |
| pointer target stable | DOM geometry/hit testing | category click target remains at same measured location before/after result state | Playwright | no evidence | executed pointer/rect sequence |
| keyboard focus coherent | DOM focus | category change preserves a documented focus owner; result navigation still reaches result | RTL + Playwright only if browser focus differs | `autoFocus` and `focusRelative` source | accepted focus policy + execution |

## Measurement protocol

At one fixed viewport, collect `getBoundingClientRect()` for:

- `region[aria-label="Search"]` outer panel;
- `role=tablist` and every tab button;
- `getByLabel("Search Plasmon")` input;
- `[data-search-result]` result region container;
- result region `scrollHeight` and `clientHeight`.

Use named measurement objects and compare category transitions to the initial
Apps measurement. “Substantially” means a tolerance justified by measured
browser rounding/scrollbar changes, not a CSS constant copied into the test.
A practical implementation may set a small comparison tolerance for subpixel
rounding and record it with the artifact; it must not assert the current 680px,
48vh, or any other implementation value as the acceptance contract.

## Required journeys

1. Open Search at the configured fixed viewport; record Apps with populated
   results.
2. Switch Documents, Media, and Atoms; record each with populated/sparse state.
3. Enter a query guaranteed by the production fixture to yield no result; record
   empty-state frame and focus.
4. Restore a fixture query with enough production results to require internal
   scrolling; assert scroll container owns overflow rather than outer frame.
5. Click a category after the result body changes and verify the pointer target
   is still the measured category button.
6. Keyboard-focus input, switch category with keyboard, and verify focus follows
   the accepted surface policy; Arrow navigation and Enter remain usable.
7. Assert panel and result region stay inside the viewport using measured bounds.

The future implementor must use the existing packaged browser/health harness and
accepted fixture resources. Do not seed a test-local classifier or bypass Shell
with a directly mounted fake Search component.
