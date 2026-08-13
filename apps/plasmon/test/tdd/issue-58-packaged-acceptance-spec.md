# #58 packaged acceptance specification

Use `apps/review/e2e/review.spec.ts` with the vanilla Review deployment, not the
Plasmon iframe. Attest installed package bytes, authenticate through the
canonical local session, open Review.neutron from the Kernel tile, create an Atom,
add item/evidence/coordination/comment, export Markdown through Files, import it
as a second Atom, reload, select both Atoms, and verify identity/current state.

Strict observations: no Plasmon/MTN dependency, no unexpected package/console
errors, readable accessible controls, Files approval only at the documented
boundary, original and imported AtomIds distinct, history count and restore
semantics visible. Screenshots/manual review cover visual #170 separately. A
successful Plasmon Review sibling-tile proof is not sufficient for #58's
standalone package claim.
