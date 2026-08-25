# Repository support tooling

`support/` contains maintained support and operational products that are not ordinary `apps/*` workspaces.

- [`dispenser/`](dispenser/README.md) provides the user-facing bootstrap/dispenser product;
- [`repository/`](repository/README.md) provides the static example repository and deterministic resource generator;
- [`update-source/`](update-source/README.md) provides the developer-owned certified package update source.

Their package and deployment contracts remain subordinate to the canonical repository documentation under [`../doc/`](../doc/). Every direct support child is classified by the repository ownership registry.
