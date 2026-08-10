# Associations, Atoms, and shortcuts

This directory implements Agent 2's association/Atom subsystem behind the frozen contracts in `../contracts/**`.

## Invariants

- `HandlerDefinition` is metadata only. This subsystem never launches native apps or Neutron Elements directly; `OpenWithServiceModel` delegates execution to the injected public `OpenService`.
- Atom identity is the descriptor's immutable `atomId`. File name, parent directory, path, title, handler version, and other mutable metadata are not identity. `updateAtomDescriptor()` therefore cannot replace `atomId`.
- Atoms remain filesystem resources. The local descriptor is stored as JSON-compatible `node.metadata.atom`; package/import helpers do not create a second Atom object hierarchy.
- Resolution is deterministic. Source precedence is: node `opensWith`; Atom descriptor handler; Atom-type rule; shortcut handler/BaseURL alias; compound extension; ordinary extension; MIME. Within a source, user defaults are promoted, then specificity/priority, then rule ID and handler ID provide stable tie-breaks.
- Extension matching is case-insensitive. Compound extensions such as `.spreadsheet.atom` outrank `.atom`. MIME matching is case-insensitive, strips parameters, and supports exact, `type/*`, and `*/*` rules.
- Rules fail fast when malformed or when they reference an unregistered handler. A repeated handler ID or rule ID replaces the earlier registration so metadata discovery can refresh deterministically.
- User defaults use stable keys: `extension:.md`, `mime:text/markdown`, and `atom:spreadsheet/v1`. `MemoryAssociationDefaultStore` is useful in tests; `LocalStorageAssociationDefaultStore` provides browser persistence without coupling the public contract to storage details.
- `.url` resources use the Windows/daedalOS `[InternetShortcut]` form. `Handler=` is Plasmon-specific; `BaseURL=` remains accepted for compatibility. Parsing malformed resources returns structured errors through `tryParseInternetShortcut()`.
- Downloaded `.atom` resources are ZIP-compatible packages containing `atom.json` and a payload entry. The writer uses the universally supported ZIP store method and deterministic entry ordering. The reader validates paths, bounds, duplicate names, uncompressed-size limits, CRC-32, required manifest fields, and payload presence; it also accepts deflate entries when the runtime exposes `DecompressionStream("deflate-raw")`.
- Malformed Atom metadata/packages never need to crash association resolution. Invalid embedded data is ignored for matching so lower-precedence extension/MIME handlers can still be offered, while parsing/Open With APIs surface warnings or structured errors to callers.

## Main API

- `HandlerAssociationRegistry` — handler/rule registration, matching, priorities, defaults, and deterministic resolution.
- `OpenWithServiceModel` — ordered Open With candidates, target construction, default selection, and execution delegation.
- `serializeAtomDescriptor()` / `parseAtomDescriptor()` / `updateAtomDescriptor()` — canonical Atom metadata handling.
- `createAtomPackage()` / `tryParseAtomPackage()` — portable compound `.atom` interchange resources.
- `writeInternetShortcut()` / `tryParseInternetShortcut()` — `.url` compatibility.

The subsystem intentionally does not import filesystem implementation classes, process runtime implementation, Neutron bridge implementation, Desktop/Explorer, sharing, or backup code.
