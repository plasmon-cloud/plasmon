# Plasmon glossary

This glossary owns shared Plasmon terminology that is useful across subsystem boundaries. It defines names and identity distinctions; it is not a replacement for scoped `README.md`, `AGENTS.md`, contracts, testing guidance, or canonical architecture documents.

When a term has subsystem-specific behavior, follow the owning documentation and implementation linked from [`README.md`](README.md).

## Neutron

**Neutron** is the kernel/runtime and application platform underneath Plasmon.

Neutron owns Kernel security, AppScope isolation, capabilities, installation, package execution, and other Kernel-level runtime authority. Plasmon consumes those capabilities; normal Plasmon work should not silently redefine them.

## Plasmon

**Plasmon** is the user-facing desktop and application environment running on Neutron.

Its normal product workspace is `apps/plasmon/`. Plasmon owns desktop/application experience and Plasmon-local product services while leaving Kernel authority with Neutron.

## Element

An **Element** is a Neutron application/package identity.

One installed Element may operate on many user resources. Element identity is not a Plasmon filesystem NodeId, native process, window, Atom, or AppScope.

## Isotope

An **Isotope** is a variant, version, or runtime profile of an Element where that distinction is required by the Neutron application model.

## AppScope

An **AppScope** is a Neutron isolation/runtime security scope.

AppScope identity is not logical application-resource identity. In particular, an Atom, filesystem node, provider revision, process, or window must not be treated as an AppScope merely because a runtime operation connects them.

## Atom

An **Atom** is an application-defined, independently addressable logical resource.

One physical Element installation may own many Atoms. Therefore:

```text
Atom != Element installation
Atom != AppScope
Atom != filesystem path
Atom != filesystem NodeId by definition
Atom != native process
Atom != window
Atom != historical revision
```

An application may deliberately map an Atom to another stable resource identity, but that mapping belongs to the application's accepted contract rather than to the definition of Atom itself.

See [`atoms/README.md`](atoms/README.md) for the current Atom design index.

## NodeId

A **NodeId** is the stable identity of a Plasmon filesystem node.

Visible path and display name are mutable. Rename or move should not inherently turn a filesystem node into a different logical filesystem object. Long-lived filesystem references such as shortcuts should prefer stable identity where the filesystem contract provides it.

NodeId is filesystem identity; it is not automatically Atom, Element, AppScope, process, window, or provider identity.

## `.neutron`

A **`.neutron` package** is a Neutron application/package.

Plasmon may project installed applications into its filesystem, for example as resources under `/Apps`. Such a filesystem projection is not the installation authority itself. Neutron remains authoritative for installation and execution state.

Do not infer complete application/runtime semantics from the filename suffix alone.

## `.sys`

A **`.sys` resource** represents an actual Plasmon-native application or system program.

It is not a generic facade for another runtime. A runtime such as js-dos or EmulatorJS participates through its real handler/runtime identity rather than requiring an invented `DOS.sys`, `Emulator.sys`, or `Games.sys` wrapper.

## Program Files

`/System/Program Files/` is the Plasmon filesystem location for curated runtime/application resources that must be exposed or packaged as filesystem resources.

Examples may include runtime assets such as js-dos, EmulatorJS, or Monaco resources. Presence under Program Files does not imply that a corresponding `.sys` wrapper should exist.

## AssociationRegistry

**AssociationRegistry** is the Plasmon authority that registers file/resource handlers and resolves deterministic matches/defaults used by the canonical opening path.

Conceptually:

```text
resource
  -> canonical filesystem/open path
  -> AssociationRegistry handler selection
  -> application or runtime host
```

Application- or game-title-specific dispatch should not replace ordinary association semantics when resource metadata and registered handlers can express the behavior.

## Process and window identity

A **native process** is Plasmon-local application lifecycle state owned by the Process subsystem. A **window** is Plasmon-local presentation/lifecycle state owned by Windowing.

Neither is a Neutron Element/AppScope, filesystem NodeId, or Atom. One user action may connect these identities, but the connection does not make them interchangeable.

## Provider resource and revision

Sharing/provider storage may introduce provider resource identity and immutable provider revisions. Those identities belong to the Sharing/provider contract and remain distinct from Atom, NodeId, AppScope, process, and window identity unless an accepted application contract explicitly maps them.

MTN/Neutron remain authoritative for cross-AppScope authorization; provider storage does not become a shadow authorization authority.

## Identity rule

When implementation connects multiple layers, preserve the authority that owns each identity:

```text
Neutron installation/runtime -> Element / AppScope
Plasmon filesystem           -> NodeId
application domain           -> Atom or application-defined resource identity
Plasmon native lifecycle     -> process / window identity
Sharing provider             -> provider resource / revision identity
```

Do not recover one identity from another through mutable presentation such as filename, visible path, window title, basename, or suffix unless the owning contract explicitly defines that mapping.
