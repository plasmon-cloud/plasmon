# Issue #171 — Neutron icon acceptance

Disposition: **DETERMINISTIC RESOLVER GREEN / INSTALLED BROWSER ACCEPTANCE PENDING**.

## Deterministic evidence

Current `icon-resolver.test.ts`, `icon-bridge.test.ts`, and Neutron adapter tests
prove safe declared metadata, bounded compatibility candidates, timeout,
short-circuiting, missing/failed fallback, caching, descriptor invalidation,
runtime-refresh separation, and unsafe path rejection. This is not complete
Issue acceptance because the canonical Issue explicitly concerns installed
browser request/error behavior.

## Required installed browser gate

Use a real installed Neutron Element with a declared icon and a second installed
Element with no icon. Observe the actual request log and browser health during
initial discovery and one unchanged refresh. Assert:

- declared icon is used successfully;
- icon-less Element receives the deterministic shared fallback;
- candidate requests remain within the bounded resolver policy;
- unchanged refresh does not re-probe metadata/icons unnecessarily;
- no speculative `.png`/`.jpg`/`.webp` fan-out beyond the accepted bounded
  compatibility policy;
- no 404 or `net::ERR_BLOCKED_BY_ORB` storm occurs.

The gate must use the strict #187 browser-health baseline and a real installed
package/Element origin. It must not weaken ORB/CORS/security policy and must
remain distinct from #190's Plasmon-owned shared asset root. Until executed in a
healthy packaged environment, #171 is not complete green.
