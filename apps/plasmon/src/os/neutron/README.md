# Plasmon Neutron bridge

This directory owns the adapter between the frozen `NeutronBridge` contract and Neutron-specific APIs.

## Invariants

- Real Neutron Elements are launched only through Kernel `workspace.open_tile`. The bridge never embeds or returns an application iframe/window; authenticated Elements remain Kernel-created sibling surfaces.
- Vanilla discovery uses `apps.list` plus cached per-app `apps.describe`. A bad or temporarily unavailable descriptor degrades only that Element. Invalid individual list entries and tile entries are ignored rather than invalidating unrelated apps.
- Runtime state is a best-effort snapshot from `endpoints.list`: a live tile means `running: "yes"`, a valid snapshot without a live tile means `"no"`, and an unavailable/malformed snapshot means `"unknown"`.
- Runtime refresh is separate from metadata discovery. Once Elements are loaded, focus/pageshow/visibility refreshes call only `endpoints.list`; they do not redescribe unchanged Elements or redo icon resolution.
- The default launch uses the first valid tile. Callers may select another declared tile and may pass a `view`; both are forwarded to `workspace.open_tile` with `reuseExisting: true`.
- Install requests remain Kernel-mediated through `apps.install_offer`; this adapter does not install packages directly.
- Subscribers are notified by explicit runtime refreshes. While subscribed, vanilla mode also refreshes best-effort on browser focus/pageshow and when the document becomes visible because vanilla Neutron has no authoritative lifecycle subscription API.
- Standalone rendering uses a preview bridge and does not attempt Kernel calls.
- GUI2's existing `src/platform/**` implementation remains untouched as a reference/compatibility path. Integration should switch composition from `LegacyNeutronBridge` to `createNeutronBridge()` when Agent 8 is merged.

## Metadata and icon caching

Element descriptor/icon outcomes are cached by stable app id plus the short discovery description returned by `apps.list`. Successful icons, missing icons, failed icon probes and descriptor fallbacks are all retained so repeated `loadElements()` calls do not cause repeated descriptor or image requests. Cache entries are removed when an app disappears and are invalidated if its real `apps.list` description changes.

The current Kernel `apps.list` response exposes only `id` and `description`; it does not expose app version, registry generation or another revision token. `apps.describe` exposes `version`, but reading that value requires performing the metadata call that the cache is intended to avoid. Therefore a version-only update that preserves the same app id and discovery description cannot be detected cheaply by this API. Bridge recreation or an observable discovery change refreshes that metadata; no synthetic version field or polling loop is invented here.

## Icons

Icon resolution is descriptor-driven and remains internal to the bridge. The frozen `ExternalElement` contract still exposes only `icon?: string`; public tile/tray contracts are not expanded.

When `apps.describe` provides a safe icon declaration, the bridge uses only that declared bounded package-local relative path. External/scheme-relative URLs, URI schemes, absolute paths, traversal, backslashes, query/fragment suffixes and encoded path tricks are rejected. A safe declared path is resolved through Neutron's existing `appIndexUrl` helper and probed sequentially across the preferred and resident/unprefixed app-origin forms. The first success stops further requests, so a declared icon requires at most two probes.

The underlying Neutron package registry already retains normalized tile/tray icon paths (for example Kitchen Sink declares `static/icon.svg` and `static/tray-demo.svg`), but the current Kernel `apps.describe` projection strips those icon/path fields. To preserve package icons without restoring the old request storm, missing safe descriptor metadata uses only two justified compatibility paths: `static/icon.svg`, then `static/icon.png` (the normalized tile default). Each path tries the preferred origin and then the alternate origin sequentially, with immediate short-circuit on success. The worst case is therefore four first-load icon probes; WebP/JPEG and other extension guessing are not performed.

All icon outcomes are cached with the Element metadata, including complete compatibility failure. Repeated `loadElements()` calls for an unchanged Element and runtime-only focus/pageshow/visibility refreshes therefore perform zero additional icon probes.

## MTN 0.2 authorization boundary

The authoritative MTN dependency is external repository `plasmon-cloud/multitenancy-neutron` at accepted SHA `13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a`. No MTN source is vendored or copied into Plasmon.

Accepted MTN 0.2 separates authorization into two surfaces:

- public Kernel actor methods `kernel_authorization_capabilities`, `kernel_authorization_inspect`, and `kernel_authorization_redeem`;
- compiler-delivered backend `AuthorizationV1`, bound to one exact physical AppScope, with `issue`, `list`, `revoke`, `rotate_resource`, `register_provider`, `call`, `delegate`, and `release`.

The exact AppScope-bound split is security-significant. Plasmon must not turn the backend methods into caller-selectable provider/issuer/consumer scopes.

Provider callback registration is lifecycle metadata, not authority. Accepted MTN allows `register_provider` for an installed/active exact AppScope before that physical provider is assigned to a tenant. Issue/list/revoke/rotate/call/delegate still recheck the accepted MTN ownership/liveness rules; Plasmon must not require assignment merely to register the callback.

### Frozen Plasmon contract mismatch

The current frozen `ResourceAuthorizationService` predates the shipped MTN 0.2 surface and cannot yet be implemented faithfully:

1. Plasmon `ResourceRef` requires `providerId`, `resourceId`, and `revision` (plus optional metadata). MTN authorization identifies a resource as `namespace`, `resource_id`, and `resource_type`; MTN grant/lease records do not carry the Plasmon provider revision needed to reconstruct the frozen `ResourceRef` on inspect/redeem.
2. Plasmon `redeem({ token })` supplies no consumer AppScope. MTN redemption requires an explicit exact `consumer_scope` and verifies that the authenticated principal currently owns that active scope and satisfies the grant's consumer Element policy.
3. MTN redemption returns a short-lived `AuthorizationLease` with `lease_id`, and that lease id is the authority handle required by bound `call`, `delegate`, and `release`. Frozen Plasmon `ResourceAuthorization` has no lease handle. Dropping it would require hidden adapter state to continue the MTN lifecycle.
4. Frozen Plasmon `expiresAt` is a JavaScript `number` with no specified unit/encoding. MTN uses `Nat64` timestamps derived from `Time.now()` nanoseconds; current epoch-nanosecond values cannot be represented losslessly as a JavaScript safe integer.
5. MTN issuer operations required by Plasmon (`issue`, full issuer inspection via `list`, and `revoke`) are not public browser Kernel methods. They exist only on the compiler-bound backend `AuthorizationV1`. The current Plasmon package does not declare `backend.capabilities.authorization`, and the existing `neutron-tools/app` browser transport exposes no MTN authorization bridge.
6. MTN's public `kernel_authorization_inspect` is intentionally safe pre-authentication metadata. It omits exact `resource_id`, provider/issuer scopes, audience, and bearer material, so it cannot satisfy Plasmon's full `ResourceGrantSummary` without shadow state (which is forbidden).

`BlockedMtnResourceAuthorizationService` therefore advertises `available: false` and fails every authority-bearing operation closed. It stores no authorization state. `supportsMtnAuthorizationDiscovery()` is limited to generic operation/right detection and does not sniff MTN product/version strings.

Coordinator A must perform one deliberate contract/integration reconciliation before a production MTN adapter is enabled. See `DEPENDENCIES.md` for the exact missing seams.
