# Issue #173 — repaired browser RED packet

Disposition: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**.

## Reference interpretation

Canonical #173 explicitly rejects the current vertical full-width List as
“Details with information removed.” The accepted reference behavior is a
compact desktop file-list arrangement that uses multiple horizontal columns
(or an equally deliberate compact arrangement), while Details remains a
metadata table/column view. The packet therefore does **not** preserve the
current single vertical column.

## PRESERVE

- one shared NodeId selection model;
- activation/open, rename, context menu, clipboard, drag/drop eligibility and
  shared resource presentation;
- Details metadata columns (`Type`, `Size`, `Modified`);
- responsive usability and no new filesystem authority.

## CHANGE

- List entries are compact and flow through more than one spatial column at
  normal window widths, rather than occupying one full-width vertical row;
- List uses the available horizontal area efficiently without becoming Details;
- keyboard arrows follow rendered spatial neighbors;
- List remains distinct from Icons/Grid and Details.

## UNSPECIFIED

- CSS grid versus another layout mechanism;
- exact column count, row height, breakpoints and strategy/component names;
- final #196 view-strategy API.

## Executable browser gate

`test/e2e/plasmon-list-layout-173.red.spec.ts` measures actual rendered option
geometry and does not assert CSS class implementation as the product contract.
It requires multiple rendered x-columns, compact width, ArrowRight movement to a
later rendered column, and a wider Details metadata row. The current production
List is one full-width flex column and universal linear keyboard policy, so the
intended assertions fail after packaged boot; missing session/browser failure is
an operational block, not product RED.

The gate creates a real document through Desktop/FileManager, opens the real
Explorer window, and selects views through the accessible View control. It does
not define #196 architecture. Lower-layer common selection/activation semantics
remain covered once by FileManager model/RTL tests.
