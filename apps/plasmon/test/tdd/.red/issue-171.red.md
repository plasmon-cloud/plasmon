# Issue #171 — characterization / browser verification note

Classification: **CHARACTERIZATION / ALREADY GREEN** for the deterministic
resolver contract; packaged installed-Element verification remains a separate
browser boundary.

## Evidence

Current `src/os/neutron/icon-resolver.ts` and `icon-bridge.test.ts` already
cover:

- safe declared package-local icon metadata;
- descriptor-first resolution;
- bounded compatibility candidates;
- sequential verified probing with timeout;
- success short-circuiting;
- safe missing/failed fallback;
- caching and invalidation on descriptor identity changes;
- runtime refresh without repeated icon discovery;
- unsafe URL/path rejection.

The existing resolver suite is green and no truthful implementation-independent
headless RED remains. Do not duplicate #190: #190 owns Plasmon package-owned
shared assets, while #171 owns installed Neutron Element/package icon metadata.

## Remaining packaged boundary

Use a real installed Element with a declared icon and one without an icon. Record
all requests and browser console/request failures during initial discovery and a
second unchanged refresh. Acceptance requires authoritative icon use where
available, deterministic fallback where absent, no speculative extension fan-out,
and no 404/ORB storm. Keep Neutron package origin and Plasmon app origin
separate; do not weaken CORS/ORB or security policy to make the gate pass.
