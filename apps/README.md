# Neutron applications

`apps/` contains first-party Neutron application packages and the Kernel package. Each maintained child owns its package manifest, source, tests, and local README; the repository map records the owning documentation for every child.

- [`kernel/`](kernel/README.md) is the replaceable Neutron Kernel package and remains authoritative for Kernel/runtime behavior.
- [`plasmon/`](plasmon/README.md) is the user-facing desktop application and delegates its nested documentation boundaries to [`plasmon/docs/`](plasmon/docs/README.md).
- Other children are first-party applications, examples, or explicitly documented fixtures. Their package manifests and local READMEs are the entry points for app-specific behavior.

Shared package, installation, security, and deployment contracts remain authoritative under [`../doc/`](../doc/).
