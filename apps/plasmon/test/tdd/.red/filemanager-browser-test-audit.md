# FileManager/Desktop browser-test audit

Reviewed current `test/e2e` Desktop/FileManager specs and newly repaired gates.

## Swallowed setup / environment failures

- Repaired #110 removed `.catch(() => undefined)` around the reload/reopen
  action; failed root lookup now fails before persistence assertions.
- New #66/#93/#95/#173 gates throw on missing bounds, iframe, destination and
  entry rather than converting setup failures into expected RED.
- Missing `local.ndeploy.session.json` remains an operational block and is not
  caught by test logic.

## Implementation coupling

- Stable semantic selectors used: roles, accessible labels, `data-fm-node-id`,
  `aria-selected`, and `data-fm-drag-preview`/count contract.
- Existing `is-dragging`, `is-drop-target`, and expanded-label selectors are
  retained only where the browser contract has no accessible equivalent; future
  production work should expose stable state data if these become migration
  hazards.
- No exact pixel goldens or z-index number assertions are used.

## Health accounting

- #190 now uses the accepted #187 unrelated allowances and intentionally omits
  only the `/static/plasmon/icons` allowances being retired.
- #66 uses strict health with no broad allow list; its eventual implementation
  must account for unrelated canonical diagnostics through the shared baseline,
  not by weakening this packet.
- #93/#95/#110/#173/#86 need the standard packaged health helper when their
  product journey starts producing unrelated known diagnostics; none currently
  treats a crash as RED.

## Lower-layer duplication

- #51/#65/#174/#182 use Bun/RTL for domain and adapter claims, avoiding browser
  repetition of NodeId/Trash/association semantics.
- Browser gates are reserved for real stacking/hit testing, selection range,
  media decode/geometry, installed package URLs, persistence and visual layout.

## Stale assumptions

- #172 closure now reflects integrated #192 rather than “PR open only.”
- #173 no longer encodes the old single-column List defect.
- #95 is separate from #191's bounded rename editor.
- #190 no longer requires an absolute source string as its sole proof.
