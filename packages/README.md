# Neutron packages

`packages/` contains reusable repository tooling and shared runtime/compiler components. Package READMEs are the local entry points; cross-package architecture and release contracts live under [`../doc/`](../doc/).

- compiler and Motoko support packages prepare and assemble checked Neutron actors;
- `neutron-tools`, security, and design-system packages provide shared contracts and UI support;
- `neutron-provision` owns local/IC deployment and PocketIC supervision;
- `neutron-scripts` owns manifest generation, Motoko packing, validation, and archive construction.

The repository ownership registry classifies every direct package child and fails if a new child lacks an explicit documentation owner.
