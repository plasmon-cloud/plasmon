# Neutron dispenser

`support/dispenser` is the user-facing bootstrap/dispenser product. It serves repository-selected package offers and coordinates the developer-preview or production provisioning handoff; it is not the Kernel, the general provisioner, or an application-local deployment shortcut.

Use the package's local scripts for its frontend and canister workflows. The canonical provisioning, package publication, starter-package, and release contracts remain under [`../../doc/`](../../doc/); preserve those boundaries when changing the dispenser.
