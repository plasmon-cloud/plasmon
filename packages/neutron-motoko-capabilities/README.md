# Neutron Motoko capabilities

`neutron-motoko-capabilities` contains the reviewed public Motoko leaf types used by Neutron backend capabilities. It defines a deliberately narrow shared type surface rather than a deployment or runtime service.

Changes must preserve the compiler/actor assembly contracts that consume these types. See the repository compiler, capability, and app-development documents under [`../../doc/`](../../doc/) for the authoritative integration model.
