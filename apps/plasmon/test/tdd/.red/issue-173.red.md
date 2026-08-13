# Issue #173 — FULL PRODUCT RED PACKET

Classification: **FULL RED PACKET**

## Current evidence

The current FileManager has separate `grid`, `list`, and `details` class names,
but List is a single vertical flex column with only icon/name content while
Details owns metadata columns. Keyboard handling in `FileManager.tsx` currently
uses one linear ordered-id delta for all non-Desktop presentations. This leaves
List without an accepted spatial-navigation contract and makes List/Details
primarily a CSS/content difference rather than a deliberate view behavior.

## Executable gate

- `test/e2e/plasmon-list-layout-173.red.spec.ts`
- Layer: Playwright packaged browser boundary, because useful width, flow,
  actual focus movement, and rendered column geometry belong to the browser.
- Intended RED: after selecting List, `ArrowRight` advances to the next entry
  under the universal linear policy; the gate requires horizontal arrows to
  respect the accepted single-column spatial arrangement. The test also guards
  full-width compact rows and Details metadata header/row distinction.

The gate requires the existing local packaged session and does not convert a
missing session, browser crash, or runtime error into product failure. A focused
attempt on this head stopped before app boot because
`local.ndeploy.session.json` is absent; this is an operational browser block,
not product RED.

## Contract fence

Preserve one shared FileManager authority for NodeId selection, activation,
rename, context commands, clipboard, drag/drop eligibility, and resource
presentation. The packet does not prescribe a `FileManagerViewStrategy` API or
component decomposition; #196 owns that architecture after #195 stabilizes.

List acceptance:

- compact row/column presentation makes useful horizontal use of the normal
  FileManager width;
- List is visibly and functionally distinct from Details;
- keyboard movement follows its actual spatial arrangement;
- narrow windows remain usable without duplicating command semantics.

Details remains metadata-column presentation. Icons remains spatial icon
presentation. Shared behavior is verified once at lower layers and not copied
into three view-specific test suites.
