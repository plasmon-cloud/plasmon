# Repository documentation map

This page is the generated navigation map for maintained repository boundaries. The source of truth is [`documentation-ownership.json`](documentation-ownership.json); edit the registry and owning documentation, then regenerate this page. Structural validation does not claim semantic prose freshness: durable behavior, authority, contract, operational, and navigation changes still require normal documentation review.

The map distinguishes local documentation from canonical `/doc` ownership and records delegated nested contracts. Generated output is intentionally a navigation aid, not a replacement for the owning README, AGENTS, or canonical document.

<!-- neutron-repository-documentation-map:start -->
<!-- Generated from documentation-ownership.json by documentation-ownership.mjs. Do not edit this table by hand. -->
| Boundary | Role | Owning documentation | Delegation |
| --- | --- | --- | --- |
| `.` | repository-root | [README.md](../README.md)<br>[AGENTS.md](../AGENTS.md) | — |
| `.github` | ci-root | [.github/README.md](../.github/README.md) | — |
| `.github/workflows` | ci-tooling | [.github/workflows/README.md](../.github/workflows/README.md) | — |
| `doc` | canonical-documentation | [doc/index.md](./index.md) | — |
| `apps` | application-root | [apps/README.md](../apps/README.md) | — |
| `packages` | package-root | [packages/README.md](../packages/README.md) | — |
| `support` | support-root | [support/README.md](../support/README.md) | — |
| `test` | test-root | [test/README.md](../test/README.md) | — |
| `test/ci` | ci-test-tooling | [test/ci/README.md](../test/ci/README.md) | — |
| `test/e2e` | browser-test-tooling | [test/e2e/README.md](../test/e2e/README.md) | — |
| `apps/agent` | first-party-application | [apps/agent/README.md](../apps/agent/README.md) | — |
| `apps/chess` | first-party-application | [apps/chess/README.md](../apps/chess/README.md) | — |
| `apps/contacts` | first-party-application | [apps/contacts/README.md](../apps/contacts/README.md) | — |
| `apps/gemma` | first-party-application | [apps/gemma/README.md](../apps/gemma/README.md) | — |
| `apps/hello` | first-party-application | [apps/hello/README.md](../apps/hello/README.md) | — |
| `apps/hullshift` | first-party-application | [apps/hullshift/README.md](../apps/hullshift/README.md) | — |
| `apps/jetcreeper` | first-party-application | [apps/jetcreeper/README.md](../apps/jetcreeper/README.md) | — |
| `apps/kernel` | kernel-application | [apps/kernel/README.md](../apps/kernel/README.md) | — |
| `apps/kitchensink` | first-party-application | [apps/kitchensink/README.md](../apps/kitchensink/README.md) | — |
| `apps/mail` | first-party-application | [apps/mail/README.md](../apps/mail/README.md) | — |
| `apps/mysubnet` | first-party-application | [apps/mysubnet/README.md](../apps/mysubnet/README.md) | — |
| `apps/plasmon` | delegated-application | [apps/plasmon/docs/README.md](../apps/plasmon/docs/README.md) | [nested registry](../apps/plasmon/docs/documentation-boundaries.json) / [map](../apps/plasmon/docs/README.md) |
| `apps/review` | first-party-application | [apps/review/README.md](../apps/review/README.md) | — |
| `apps/spreadsheet` | first-party-application | [apps/spreadsheet/README.md](../apps/spreadsheet/README.md) | — |
| `apps/vetkeys_fixture_test` | test-fixture-application | [apps/vetkeys_fixture_test/README.md](../apps/vetkeys_fixture_test/README.md) | — |
| `apps/vfs` | first-party-application | [apps/vfs/README.md](../apps/vfs/README.md) | — |
| `apps/wagyu` | first-party-application | [apps/wagyu/README.md](../apps/wagyu/README.md) | — |
| `apps/wallet` | first-party-application | [apps/wallet/README.md](../apps/wallet/README.md) | — |
| `packages/neutron-cli` | compiler-tooling | [packages/neutron-cli/README.md](../packages/neutron-cli/README.md) | — |
| `packages/neutron-compiler` | compiler-tooling | [packages/neutron-compiler/README.md](../packages/neutron-compiler/README.md) | — |
| `packages/neutron-design-system` | shared-ui-tooling | [packages/neutron-design-system/README.md](../packages/neutron-design-system/README.md) | — |
| `packages/neutron-motoko-capabilities` | compiler-tooling | [packages/neutron-motoko-capabilities/README.md](../packages/neutron-motoko-capabilities/README.md) | — |
| `packages/neutron-motoko-wasm` | compiler-tooling | [packages/neutron-motoko-wasm/README.md](../packages/neutron-motoko-wasm/README.md) | — |
| `packages/neutron-provision` | provisioning-tooling | [packages/neutron-provision/README.md](../packages/neutron-provision/README.md) | — |
| `packages/neutron-scripts` | packaging-tooling | [packages/neutron-scripts/README.md](../packages/neutron-scripts/README.md) | — |
| `packages/neutron-security` | security-tooling | [packages/neutron-security/README.md](../packages/neutron-security/README.md) | — |
| `packages/neutron-tools` | shared-tooling | [packages/neutron-tools/README.md](../packages/neutron-tools/README.md) | — |
| `support/dispenser` | support-application | [support/dispenser/README.md](../support/dispenser/README.md) | — |
| `support/repository` | support-tooling | [support/repository/README.md](../support/repository/README.md) | — |
| `support/update-source` | support-tooling | [support/update-source/README.md](../support/update-source/README.md) | — |
<!-- neutron-repository-documentation-map:end -->
