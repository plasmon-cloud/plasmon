# Plasmon Neutron bridge

`neutron/**` is Plasmon's adapter to verified vanilla Neutron capabilities behind the public `NeutronBridge` contract.

## Boundary

Neutron remains authoritative for application installation, AppScope isolation, capabilities, package execution, tiles, and Kernel security. Plasmon discovers/describes applications and requests Kernel operations; it does not obtain or embed authenticated application surfaces as local native windows.

`VanillaNeutronBridge` currently adapts installed application discovery/description, runtime endpoint snapshots, Kernel tile opening, install offers, icon metadata resolution, and best-effort foreground lifecycle refresh. Standalone preview uses a separate preview bridge rather than pretending Kernel calls exist.

Runtime information can be unavailable. The bridge preserves an explicit unknown state rather than manufacturing a negative answer from a failed snapshot.

## Vanilla Neutron uninstall boundary

Vanilla Neutron has a real application-uninstall lifecycle, but current ordinary applications do not have a supported app-facing API for requesting it. Kernel frontend orchestration owns `uninstall_app`; it recompiles and deploys the combined runtime without the target application through the checked install/deployment journal. The Kernel refuses to remove itself, refuses removal of an application that still has installed dependents, and owns the destructive user confirmation and progress UI.

Uninstall is destructive for resources owned by the removed application. The compiler marks the application's managed-memory roots for retirement with an app-uninstall reason, removes the application from the installed registry, clears its `/app/<id>/` assets, and commits removal/reconfiguration of AppScope-bound Kernel services. Kernel frontend cleanup also removes its resident UI/runtime state and open tiles. This is not a preserve-data-for-reinstall operation.

The public application boundary is intentionally narrower. `neutron-tools/app` exposes the source-bound `apps.install_offer` flow for asking the authenticated owner to review an installation, but there is no corresponding uninstall/removal request tool or SDK helper. The Kernel install/deployment methods used by uninstall are authorized Kernel orchestration primitives, not an application capability. Plasmon must not direct-call those methods, expose compiler/deployment authority, or invent a local uninstall shim.

Therefore Plasmon must not expose a working Neutron Uninstall command until vanilla Neutron supplies a supported Kernel-owned, user-authorized application-facing request boundary for removal. The missing capability is a bounded way for an ordinary installed application to ask the Kernel/owner to uninstall a specific installed application while preserving the Kernel's existing dependency checks, destructive confirmation, deployment lifecycle, and installation authority. Its exact API belongs to Neutron and must not be guessed in this adapter.

`/Apps/*.neutron` entries remain projections only. After an authoritative Kernel installation change, Plasmon observes the new installed set through `loadElements()` and filesystem-core reconciliation removes projections whose Element IDs are no longer installed. Bridge lifecycle invalidation is only a refresh trigger; it must never be interpreted as permission to delete a projection locally. If a future supported uninstall request reports completion, Plasmon should trigger the same full authoritative discovery/reconciliation rather than deleting the target projection directly.

## Resilience and caching

Malformed or unavailable metadata for one external application should not poison unrelated applications. Metadata/icon caching is an efficiency layer and must not change authority: invalidate when the available Kernel discovery identity changes, and keep runtime refresh separate from expensive metadata discovery when possible.

Untrusted package metadata must be safety-bounded before it becomes a URL/resource request.

## Refactor direction

Keep API codecs/parsing, metadata/icon resolution/cache, lifecycle refresh, and the public bridge thin and separable. When compatibility adapters are no longer used by the active composition, retire them instead of maintaining multiple Neutron authorities.

Do not invent missing Kernel APIs to satisfy a Plasmon UI. Missing capabilities and cross-AppScope authorization belong at the accepted Neutron/MTN boundary and should be escalated.

## Testing

Use fast adapter tests with fake APIs for malformed-response isolation, discovery parsing, runtime uncertainty, caching/invalidation, icon/path safety, open/install argument forwarding, and lifecycle subscription cleanup. Use browser tests for actual focus/pageshow/visibility lifecycle mechanics. Use installed/package integration when claiming behavior against a real Kernel rather than a fake API.
