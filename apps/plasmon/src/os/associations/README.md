# Associations and Open With

<!-- plasmon-docs-review:v1 sha256=c12a9d75cc12cd0b1e6fa0df29670fa9c9e61141a6a4e8820fe74aa7b036ff51 base=0c9f91b341800f91113aeb269a6438165eb825c8 -->

`associations/**` implements Plasmon's shared handler catalog, deterministic resource matching, user defaults, Open With model, and logical resource/compatibility parsers used by the association system.

## Responsibilities

`HandlerAssociationRegistry` is the matching authority. It normalizes registered handlers/rules, resolves explicit/resource metadata plus extension/MIME/logical-resource matches, applies persisted defaults, and returns deterministic ordered candidates.

`OpenWithServiceModel` turns those candidates into a consumer-facing model for one-off opening and persisted default selection while delegating execution through the public `OpenService`. Association code chooses handlers; it does not become the native process manager or Neutron launcher.

Logical Atom/resource helpers keep immutable logical identity distinct from path/name and physical application/process identity. Package/shortcut parsers are compatibility/resource-description helpers, not alternate application authorities.

## Default persistence

Production and supported preview composition persist association defaults through `FsServiceAssociationDefaultStore`. Hosted Plasmon therefore reaches durable background persistence through the filesystem RPC boundary, while standalone preview uses the same `FsService` semantics over its selected filesystem repository.

`MemoryAssociationDefaultStore` remains available for isolated tests that explicitly inject an in-memory preference store. There is no supported foreground `localStorage` association-default store in the active subsystem surface; durable association preferences must not acquire a second browser-local authority.

## Refactor direction

Keep matching, persisted defaults, resource metadata/parsing, and execution delegation as separable concerns. Centralize extension/MIME/logical type knowledge here or in shared content metadata so Properties, Search, FileManager, and native apps do not grow contradictory local mappings.

UI code should consume ordered candidates/default operations rather than downcasting registries or reproducing precedence. Concrete persistence should remain behind the approved default-store interface.

## Testing

Use fast tests for registration validation, deterministic ordering, specificity/default behavior, persistence/reconstruction, malformed input, compatibility parsers, and logical-resource matching. Composition coverage should prove production defaults persist through `FsService` and survive service reconstruction. Browser tests are appropriate for the actual Open With dialog/persistence wiring, not for re-testing matching rules through clicks.
