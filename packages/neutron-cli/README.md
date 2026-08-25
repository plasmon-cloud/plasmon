# Neutron CLI

`neutron-cli` is the production-context, compile-only command-line surface for turning explicit `.neutron` package files into caller-selected Wasm and Candid outputs. It does not deploy canisters, create PocketIC identities, or build workspace packages.

The CLI consumes the compiler's checked package/install contracts. Use the repository's canonical compiler, package-format, and provisioning documentation for the surrounding workflow; do not treat this package as a second deployment authority.
