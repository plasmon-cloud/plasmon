# Neutron Motoko Wasm

`neutron-motoko-wasm` provides the vendored `wasm_of_ocaml` Motoko compiler wrapper used by Neutron tooling. It is compiler infrastructure, not an app build orchestrator or deployment service.

The package exposes Node/browser-compatible compiler entry points and keeps compiler lifecycle behavior covered by its local tests. The repository compiler and package documentation under [`../../doc/`](../../doc/) define how it participates in checked actor assembly.
