# Plasmon

Plasmon starts from Neutron's `apps/hello` application on the upstream `dev` branch. The `init` branch intentionally stays close to that known-good app so the official Neutron validation, frontend build, Motoko packaging, method-schema generation, and `.neutron` archive flow can be verified before launcher development begins.

## Setup

From the repository root:

```sh
npm install
```

Then validate the Plasmon app:

```sh
cd apps/plasmon
npm test
npm run package
```

`npm test` already runs the package pipeline before the Bun tests. Running `npm run package` separately mirrors the upstream Hello getting-started workflow and makes the generated `plasmon.v0.1.0.neutron` archive explicit.

## Fast frontend iteration

For frontend-only work after dependencies are installed:

```sh
cd apps/plasmon
npm run watch
```

This rebuilds the Plasmon frontend without rebuilding the Neutron Kernel. The app is still opened and isolated by the outer Neutron Kernel when installed normally.

## Branches

- `dev` — untouched Neutron upstream-development baseline.
- `init` — Hello-derived Plasmon app baseline.
- `version-0.1.0` — Plasmon launcher implementation built from `init`.

The sample `hello_world` backend remains on `init` deliberately. It is a packaging/runtime smoke test, not part of the long-term Plasmon product model.
