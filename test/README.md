# Repository test and evidence boundaries

`test/` contains repository-wide test harnesses and acceptance evidence that cross workspace boundaries. It is not a second product implementation tree.

- [`ci/`](ci/README.md) owns deterministic CI-contract verifiers, test inventory, flake evidence, and gate orchestration;
- [`e2e/`](e2e/README.md) owns installed Neutron/Playwright acceptance helpers and browser specs.

Workspace-local unit and integration tests remain with their owning package or app. The canonical test-layer and evidence rules are documented in [`../doc/testing-and-verification.md`](../doc/testing-and-verification.md).
