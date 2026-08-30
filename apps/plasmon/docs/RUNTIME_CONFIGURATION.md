# Optional runtime configuration and delivery

Issue #370 owns the optional-runtime configuration and delivery dimension for Plasmon. It is deliberately independent from package tier, Demo content, writable Program Files user configuration, and runtime-specific logging.

## Decision

R3 uses **declarative runtime selection with preparation-time on-demand acquisition into a content-addressed cache**.

A runtime is acquired only when a supported Base/Demo preparation explicitly selects a runtime configuration. Acquisition verifies immutable upstream integrity before any consumer may materialize runtime files. The preparation cache is not a Plasmon durable user store and is not browser runtime authority.

#522 and #523 consume this mechanism. They remain responsible for extracting only the assets their runtime hosts need, materializing the accepted Program Files/browser transport representation, registering the runtime only when those assets are available, and proving real browser startup. #370 does not independently restore either runtime.

The selected R3 flow is:

```text
package tier:          Slim | Base
Demo overlay:          false | true
runtime configuration: none | demo-games | custom selection

Base/Demo preparation
  -> resolve runtime selection
  -> canonical pinned runtime catalog
  -> fetch selected source archive(s) only when absent from cache
  -> verify size + immutable digest
  -> content-addressed preparation cache
  -> #522/#523 runtime-specific materialization
  -> Plasmon package / supported Demo preparation
```

There is no browser first-use download in the R3 mechanism and no new runtime-specific `.neutron` package type.

## Three independent dimensions

The durable composition model is:

| Dimension | Values / authority | Meaning |
| --- | --- | --- |
| Package tier | `slim`, `base` | What ordinary Plasmon package capability is built. Slim is constrained; Base is ordinary. |
| Demo overlay | false / true | Whether explicit Demo/bootstrap content is reconciled. Demo is Base plus this overlay, not a package tier. |
| Runtime configuration | `none`, `demo-games`, or a custom JSON selection | Which optional heavyweight runtime definitions are prepared. |

These dimensions must remain independently observable in tests.

### Slim invariant

Slim is permanently constrained to `<1,900,000` bytes and never accepts heavyweight runtime/game payloads. `resolveRuntimeConfiguration()` therefore rejects any non-empty runtime configuration when `packageTier === "slim"` instead of silently inflating Slim.

The empty `none` runtime selection remains valid with Slim so tooling can represent the same three dimensions consistently.

### Base invariant

Base with runtime configuration `none` contains no js-dos or EmulatorJS payloads. Selecting a runtime configuration is explicit preparation input; it is not a new package-profile spelling such as `base-with-jsdos`.

### Demo

Demo is Base plus its independently selected Demo overlay. A Demo preparation may additionally select `demo-games`, but the overlay and runtime selection are separate values. The built-in `demo-games` configuration uses the same runtime catalog and selection parser available to custom configurations.

## Canonical runtime catalog

[`../runtimeConfiguration.ts`](../runtimeConfiguration.ts) owns the supported optional-runtime definitions below UI concerns. It currently declares:

| Runtime | Version | Immutable source authority | Delivery | Required runtime assets |
| --- | --- | --- | --- | --- |
| `js-dos` | 8.4.1 | upstream release archive plus SHA-256 integrity | `prepared` | js-dos JS/CSS and required emulator JS/Wasm files |
| `emulatorjs` | 4.2.3 | pinned npm `@emulatorjs/emulatorjs` and `@emulatorjs/core-fceumm` tarballs plus SHA-512 integrity; upstream tag commit recorded as provenance | `prepared` | loader, emulator JS/CSS, extraction helper, fceumm core data |

The catalog also exposes the supported Plasmon runtime-host contract, license/provenance, required asset inventory, cache policy, and optional content dependency list.

Custom configuration files select supported runtime IDs; they do **not** provide arbitrary URLs or replace catalog pins. This keeps a convenient custom selection from becoming an unreviewed executable-code authority.

## Configuration schema

Runtime selection is a closed JSON object:

```json
{
  "format": "plasmon-runtime-config-v1",
  "id": "my-runtime-set",
  "runtimes": ["js-dos"]
}
```

The allowed fields are exactly `format`, `id`, and `runtimes`. Unknown fields fail closed.

Built-ins live in [`../runtime-configurations/`](../runtime-configurations/):

```json
{
  "format": "plasmon-runtime-config-v1",
  "id": "none",
  "runtimes": []
}
```

and:

```json
{
  "format": "plasmon-runtime-config-v1",
  "id": "demo-games",
  "runtimes": ["js-dos", "emulatorjs"]
}
```

Unknown runtime IDs, duplicate IDs, malformed JSON, open-ended fields, unsupported catalog compatibility, missing source pins, or malformed integrity fail before acquisition.

## Selection and preparation commands

The repository-level production integration in #522/#523 may wrap these primitives, but the #370 authority can be exercised directly without creating a package profile.

Resolve a built-in configuration:

```sh
bun apps/plasmon/runtimeConfiguration.ts resolve \
  --config demo-games \
  --tier base \
  --demo-overlay
```

Resolve a custom file:

```sh
bun apps/plasmon/runtimeConfiguration.ts resolve \
  --config ./my-runtime-config.json \
  --tier base
```

`PLASMON_RUNTIME_CONFIGURATION` is also accepted as the selection value when `--config` is omitted. It is independent from package-tier selection.

Acquire the selected pinned source artifacts into a preparation cache:

```sh
bun apps/plasmon/runtimeConfiguration.ts prepare \
  --config demo-games \
  --tier base \
  --demo-overlay \
  --cache .plasmon/runtime-cache
```

Require already-verified cache contents without network acquisition:

```sh
bun apps/plasmon/runtimeConfiguration.ts prepare \
  --config demo-games \
  --tier base \
  --demo-overlay \
  --cache .plasmon/runtime-cache \
  --offline
```

The command emits a `plasmon-runtime-preparation-v1` JSON report containing the selected runtime IDs, each artifact's pin/source/cache path and measured bytes, and totals for downloaded versus reused cached bytes. This is build/preparation evidence, not a second Product logging API.

## Cache and integrity contract

The cache path is derived from the declared cryptographic digest, not a mutable release name. The preparation code:

1. accepts HTTPS source URLs only;
2. bounds declared and streamed artifact bytes before caching;
3. sends no credentials and no referrer;
4. verifies the complete downloaded artifact against the catalog SRI digest;
5. stores verified bytes beneath an algorithm/digest-addressed cache path;
6. re-verifies cached bytes every time they are consumed;
7. fails closed on corrupt cached bytes instead of silently replacing them;
8. in offline mode, fails with the exact missing runtime/artifact/cache identity rather than contacting the network.

HTTP redirects are transport only. A redirect target never becomes integrity authority; the catalog digest remains authoritative for accepted bytes.

A runtime version/pin change produces a different digest path. Old cache objects are not runtime state and may be removed by future generic cache housekeeping. Runtime-specific persistent user data remains owned by the runtime plus canonical Plasmon filesystem authorities; this cache never becomes save/configuration authority.

## Delivery approaches evaluated

### Selected: preparation-time pinned acquisition

**Why selected for R3:** it is implementable with current repository/build boundaries, keeps Base empty by default, allows Demo/custom selection, supports deterministic offline reuse, and verifies executable bytes before runtime-specific materialization. It requires no new Kernel capability.

The tradeoff is that a selected runtime must be prepared before the resulting deployment/package can use it. R3 intentionally accepts that boundary instead of adding an unowned browser downloader.

### Not selected for R3: browser first-use/lazy download

A browser first-use model would reduce pre-deployment work but creates unresolved authority around executable asset persistence, offline cache ownership, CSP/origin handling, user-visible failure/retry, and atomic availability of a complete runtime. Plasmon runs in a deliberately opaque Neutron application boundary, and the existing runtime hosts require controlled executable asset URLs.

R3 therefore does not fetch runtime executables from third-party sources when a user opens a game. A future generic Neutron facility could revisit this without changing the declarative runtime catalog.

### Not selected: optional runtime `.neutron` applications

Current Neutron typed application dependencies expose reviewed backend functions, not another application's frontend asset tree. Installed application assets are rewritten under `/app/<id>/`, and app-prefixed origins may read only their own subtree. A separate `js-dos-runtime.neutron` or `emulatorjs-runtime.neutron` therefore cannot currently become Plasmon's executable browser asset authority without a new generic cross-application asset capability.

Creating such a capability solely for Games would be broader than #370 and would need independent Kernel/Neutron design and review.

### Not selected: update-source packages as runtime blobs

The current update-source repository is an immutable, digest-addressed authority for complete `.neutron` application packages. Settings checks and installs whole application updates; it is not a generic per-application executable asset cache. Reusing it as though it were a runtime-byte API would blur package installation and application asset authority.

A future generic repository-backed asset capability could reuse the same integrity principles, but #370 does not pretend that primitive exists today.

### Deferred: deduplicated single physical runtime copy

Historically js-dos and EmulatorJS each had a logical Program Files copy plus a URL-safe browser transport copy. Those trees were physically duplicated because the runtime hosts needed browser-executable URLs while Program Files represented managed runtime exposure.

#370's cost reporter keeps duplicate-content measurement explicit, but does not delete one route until its serving/origin contract has a supported replacement. #522/#523 may consume a generic asset-serving improvement if one exists when they implement materialization; otherwise they must preserve the required runtime paths rather than inventing an unsafe alias.

## Neutron constraints behind the decision

Current Neutron repository documentation establishes these relevant facts:

- a `.neutron` archive is one installable application package;
- normal app frontend assets are installed under `/app/<id>/`;
- app-prefixed origins are restricted to that application's asset subtree;
- typed app dependencies are backend-function dependencies;
- update sources publish and install whole immutable digest-addressed `.neutron` packages;
- package install/update remains the authority for committed application assets.

See repository [`../../../doc/app-package-format.md`](../../../doc/app-package-format.md), [`../../../doc/asset-storage-and-http-serving.md`](../../../doc/asset-storage-and-http-serving.md), and [`../../../doc/package-updates.md`](../../../doc/package-updates.md).

## Cost and duplication reporting

[`../runtimeCostReport.ts`](../runtimeCostReport.ts) provides deterministic raw-tree, archive, category, and duplicate-content evidence:

```sh
bun apps/plasmon/runtimeCostReport.ts \
  --root apps/plasmon/dist \
  --archive apps/plasmon/plasmon.v0.1.0.neutron
```

The report groups Monaco, js-dos, EmulatorJS, game content, artwork/media, package metadata, and core Plasmon bytes and lists exact SHA-256 duplicate groups. `runtimeConfiguration.ts prepare` separately reports selected source-artifact bytes, making the optional-runtime preparation cost observable independently from Base.

Historical evidence that motivated the architecture remains useful as a scale reference, not as current R3 package proof:

- old self-contained Plasmon package: `26,817,389` bytes; active-Kernel update exceeded the 40,000,000,000 instruction/message limit at asset commit;
- intentionally pruned package without js-dos/EmulatorJS/game proof trees: `7,738,523` bytes; the same normal active-Kernel update path completed;
- merged #526 Slim: strictly `<1,900,000` bytes and permanently excludes heavyweight runtime/game payloads.

The exact current Base package measurement belongs to the Base composition produced by #527. #370's report command is the reproducible evidence tool; do not substitute the historical 7.7 MB number for the current Base result.

## Active-Kernel scalability boundary

#370 reduces optional-runtime pressure by keeping Base free of unconditional heavyweight payloads. It does not claim that package composition removes the generic Kernel correctness issue.

#373 independently owns the case where a valid supported package can activate a new actor and only then exceed one-message asset-promotion limits. Fresh active-Kernel install and update must remain separate tests there. A runtime-enabled R3 preparation must record its incremental bytes so #373 and deployment testing can evaluate the resulting supported package honestly.

## Failure, security, upgrade, and removal behavior

- **Fetch failure:** preparation fails before a runtime is materialized or registered.
- **Integrity failure:** preparation fails closed; modified bytes are never accepted.
- **Offline:** only already-present verified cache objects are usable.
- **Partial selection:** only runtimes named in the resolved configuration are acquired.
- **Upgrade:** a changed runtime version/digest creates a new immutable cache object; consumers rebuild materialized runtime assets from the newly selected plan.
- **Deselection/removal:** a subsequent preparation omits the runtime; #522/#523 own deterministic removal of their materialized build output. User save/configuration data is not cache content and must not be deleted as a side effect.
- **Origin/CSP:** acquisition occurs in trusted preparation tooling, not inside the opaque Plasmon browser frame. Runtime browser-origin behavior remains the runtime consumer's accepted existing contract.
- **Certification:** the cache itself is pre-install build state. Runtime bytes become normal Neutron application assets only through the supported package/install path used by #522/#523.
- **Logging:** #370 does not create a runtime logging API. Product runtime diagnostics must consume the canonical Sprint 3 diagnostics contract when available.

## Boundary with writable Program Files configuration

#525 owns user-editable runtime configuration projected through Program Files, beginning with Monaco settings. That is runtime **behavior/user configuration**.

#370 owns which optional heavyweight runtime implementation artifacts are selected, pinned, acquired, and prepared. A file edited by a user under Program Files must never be allowed to replace #370's executable source/integrity authority.

## Consumer contract for #522 and #523

A runtime restoration may proceed only by consuming the resolved/prepared #370 model:

1. identify its canonical runtime ID in `OPTIONAL_RUNTIME_CATALOG`;
2. require the selected preparation to contain the expected pinned artifact(s);
3. extract only its declared required runtime assets;
4. materialize the runtime-specific Program Files/browser transport representation without changing package-tier semantics;
5. register the runtime only in the supported runtime-enabled Base/Demo preparation;
6. preserve Slim and Base-with-`none` exclusions;
7. keep real runtime/browser acceptance in the runtime Issue rather than #370.

#524 then layers legal Demo game resources on Base + Demo overlay + the selected runtime configuration; game files remain ordinary filesystem resources routed through existing associations.
