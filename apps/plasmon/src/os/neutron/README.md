# Plasmon Neutron bridge

This directory owns the adapter between the frozen `NeutronBridge` contract and Neutron-specific APIs.

## Invariants

- Real Neutron Elements are launched only through Kernel `workspace.open_tile`. The bridge never embeds or returns an application iframe/window; authenticated Elements remain Kernel-created sibling surfaces.
- Vanilla discovery uses `apps.list` plus per-app `apps.describe`. A bad or temporarily unavailable descriptor degrades only that Element. Invalid individual list entries and tile entries are ignored rather than invalidating unrelated apps.
- Runtime state is a best-effort snapshot from `endpoints.list`: a live tile means `running: "yes"`, a valid snapshot without a live tile means `"no"`, and an unavailable/malformed snapshot means `"unknown"`.
- The default launch uses the first valid tile. Callers may select another declared tile and may pass a `view`; both are forwarded to `workspace.open_tile` with `reuseExisting: true`.
- Install requests remain Kernel-mediated through `apps.install_offer`; this adapter does not install packages directly.
- Subscribers are notified by explicit runtime refreshes. While subscribed, vanilla mode also refreshes best-effort on browser focus/pageshow and when the document becomes visible because vanilla Neutron has no authoritative lifecycle subscription API.
- Standalone rendering uses a preview bridge and does not attempt Kernel calls.
- GUI2's existing `src/platform/**` implementation remains untouched as a reference/compatibility path. Integration should switch composition from `LegacyNeutronBridge` to `createNeutronBridge()` when Agent 8 is merged.

## Icons

`icon-resolver.ts` preserves GUI2's safe package-local icon probing model: SVG, PNG, WebP and JPEG candidates are generated for both prefixed and resident/unprefixed app origins. The frozen bridge contract can expose one `icon` URI; consumers that implement image fallback may use the exported candidate list.

## MTN boundary

There is intentionally no `ResourceAuthorizationService` implementation here yet. Vanilla Neutron remains functional without authorization. The production authorization adapter must be implemented only after the MTN 0.2 authorization API is frozen; this directory must not invent grant/token/tool schemas in advance.
