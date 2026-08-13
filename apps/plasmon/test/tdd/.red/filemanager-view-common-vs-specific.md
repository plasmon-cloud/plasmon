# Issue #196 — common vs view-specific FileManager semantics

Status: **WAIT FOR DEPENDENCY** on #195 and #173 integration. No final strategy
API is asserted; #191 is active and must be inspected first.

## Shared common contract

Every view receives canonical resources (`FsNode`/NodeId), selection/focus
state, shared Visual presentation, and command callbacks. All views must share:

- single/additive/range selection semantics;
- focus/keyboard target identity;
- activation via FileManagerOpenAuthority;
- rename through FsService command;
- context menu actions Open/Open With/Copy/Cut/Paste/Delete/Properties;
- Trash/delete, shortcut, clipboard, drag/drop eligibility;
- canonical classification, MIME, title/icon/thumbnail fallback;
- loading/error/empty state vocabulary.

## View-specific contract

| View | Owns | Must not own |
|---|---|---|
| Icons/grid | spatial grid geometry, responsive columns, icon/thumbnail arrangement, spatial Arrow navigation | Fs/open/rename/clipboard policy |
| List | compact row/column strategy, row geometry, spatial keyboard movement according to #173 | alternate resource/classifier/command policy |
| Details | metadata columns, row navigation, accepted sort affordance | second FsNode/type/activation model |
| Desktop | persisted position presentation/reposition command; marquee geometry | generic resource semantics or placement authority outside Desktop controller |

## Acceptance layering

Pure Bun tests cover layout calculations and spatial navigation where deterministic.
RTL covers semantic selection/activation/keyboard for each strategy only where
DOM semantics matter. Playwright covers actual responsive geometry and pointer
hit testing. No view-specific browser test should repeat shared command policy.
