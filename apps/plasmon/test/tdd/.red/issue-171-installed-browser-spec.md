# Issue #171 installed-browser specification

Classification: **BROWSER SPEC ONLY**. Deterministic resolver coverage is green;
no active #171 PR. This is Neutron Element behavior, distinct from #190 Plasmon
asset-root work.

## Production journey

Through the canonical installed Kernel/Plasmon launcher:

1. discover an installed Element with declared icon metadata where available;
2. observe the displayed icon request and resolve path;
3. assert descriptor-declared package-local path is preferred and no guessed
   extension fan-out occurs;
4. exercise an Element with missing icon metadata and verify bounded sequential
   fallback plus deterministic Visual fallback;
5. assert supplied icon loads and displayed presentation is stable;
6. capture requests, console warnings/errors, ORB/404/aborted requests and
   concurrency; no uncontrolled storm is allowed;
7. confirm sandbox/security/origin behavior is unchanged.

## Evidence

Use request events and concurrency counters rather than freezing one equivalent
canonical URL. URL assertions may verify package-local ownership and accepted
origin forms. Start from strict browser health; do not add #190 allowances to
this #171 packet. Missing packaged session is **BROWSER BLOCKED**, not product
RED.
