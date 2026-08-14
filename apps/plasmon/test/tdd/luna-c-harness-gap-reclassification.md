# Luna-C HARNESS GAP reclassification

Audit base: integrated `origin/release/0.1.0-r2` at `82f176a6f11a` and the
current Luna-C branch. A `HARNESS GAP` queue marker is not itself a product
classification. The unresolved blocker for each claimed Issue is:

| Issue | exact category | unresolved blocker | route |
|---|---|---|---|
| #64 | **B — genuine missing product/runtime seam** | The current js-dos host exposes no supported save/export/import handle or explicit save boundary. The durable FsService artifact contract cannot be exercised without guessing the shipped engine API. | Future js-dos/runtime owner; not Testing infrastructure. Browser capture/restore is downstream category C. |
| #113 | **A — genuine shared Testing harness gap** for the RTL gate | The real production Text journey reaches Monaco, but canonical Happy DOM lacks `CSS.escape`; Monaco startup raises an unhandled async error. Do not polyfill/mock Monaco. The product RED (title/language/command/minimap gaps) remains separate from this harness classification. | Testing / Integration Lead only. Desired vocabulary: mount non-engine Text chrome through the production host without starting a fake Monaco, or route the whole proof to packaged browser. |
| #114 | **A — genuine shared Testing harness gap** for the RTL gate | The real production Markdown journey reaches Monaco, but canonical Happy DOM lacks `CSS.escape`; Monaco startup raises an unhandled async error. Do not polyfill/mock Monaco. Formatter/command absence remains a product RED, not a harness success. | Testing / Integration Lead only. Desired vocabulary: shared non-engine chrome adapter or packaged-browser formatter/Monaco proof. |
| #123 | **D — underspecified product contract** | #189/#190 provide classification and shared presentation, but no accepted game-artwork metadata field, provenance/envelope, size policy, or package-vs-filesystem source contract exists. | Product/Visual/Games contract owner; not Testing. |
| #124 | **E — dependency not yet integrated** | #64 has not established the authoritative NodeId-stable save artifact or successful save boundary to which a non-authoritative preview can attach. | Wait for #64; not Testing. |

## Routing rule

Only #113 and #114 are routed to Testing / Integration. #64, #123, and #124
must not be “fixed” by adding a fake test adapter, invented metadata, guessed
runtime API, or browser simulation. Their existing packets remain specification
handoffs for the owners above.

The queue tool currently stores all five under its historical `HARNESS GAP`
marker and has no category field. This document is the authoritative
reconciliation of those markers; no live queue text was edited manually.
