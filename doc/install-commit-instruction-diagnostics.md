# Install Commit Instruction Diagnostics

[Back to the documentation index](./index.md).

Use this procedure when an otherwise-valid Neutron package update reaches
`kernel_install_commit` and appears to be near or over the runtime's per-message
instruction limit. The goal is to measure the instructions consumed by the
**commit message itself**, not to infer cost from archive size or canister cycle
balance.

This is a disposable PocketIC diagnostic. Do not install an instrumented Kernel
into a production canister and do not merge the instrumentation into release
code merely to obtain a measurement.

## Why raw cycle deltas are not an instruction counter

Do not estimate one install commit by reading the canister cycle balance before
and after the call. Install/activation/refund/accounting transitions can change
the raw balance across the transaction, including increasing it. A balance
delta is therefore not a monotonic per-message execution counter and can produce
nonsensical negative instruction estimates.

Use IC performance counter 0 inside the executing update message instead. It
reports Wasm instructions executed in the current message and is the quantity
that should be compared with the runtime's per-message instruction ceiling.

## Important update-source authority

For an app-only update, the compiler does not rebuild the predecessor Kernel
from `apps/kernel/backend/main.mo` in the checkout. It reads the currently
installed certified Motoko modules into the package baseline and compiles the
target actor from that predecessor plus the incoming app package.

Consequently, editing the checkout Kernel source alone will not instrument an
app-only package update. For a disposable diagnostic, patch the installed
Kernel entry module represented in the compiler baseline (`state.existingModules`)
before the target actor is compiled. Keep the module path and the rest of the
installed predecessor source unchanged.

## Measurement pattern

1. Start a disposable PocketIC Neutron and establish the same installed
   predecessor state used by the update being investigated.
2. Build the package under test through its normal package/build path. If the
   investigation concerns a deliberately reduced package, apply exactly the same
   reduction before packing and record the resulting archive size.
3. Read the stable Kernel package baseline using the normal installer path.
4. Locate the installed Kernel entry module in `state.existingModules` by its
   semantic install entrypoint markers rather than checkout whitespace.
5. In that in-memory module source only, instrument `kernel_install_commit` so
   it runs the ordinary `commitInstall<system>` work and then samples:

   ```motoko
   Prim.performanceCounter(0)
   ```

6. Immediately after sampling, deliberately trap with a unique diagnostic
   prefix and the decimal counter value, for example:

   ```text
   NEUTRON_INSTALL_COMMIT_INSTRUCTIONS=<count>
   ```

7. Compile and run the otherwise-normal package update transaction.
8. Require the installer to reach `commit-assets`. The expected outcome is a
   rejected commit carrying the diagnostic prefix, not a successful install.
9. Parse the counter from the reject text and compare it with the runtime's
   configured message instruction limit.

The intentional trap is important. It happens only after the normal commit work
has executed, so the performance counter includes that work, while the message
trap rolls the state transition back. The ordinary install commit is idempotent;
if the installer retries the same commit after the reject, the same disposable
fixture should produce the same counter. Identical values across the retry are a
useful determinism check.

## What the measurement proves

The result is a direct measurement of Wasm instructions executed in the
instrumented `kernel_install_commit` message for that exact predecessor,
package, asset set, and runtime.

It does **not** establish a general safe package-size limit. Commit cost depends
on more than archive bytes, including asset/file count, clear prefixes,
certification work, chunk/content structure, registry reconciliation, module
GC, reservations, and other transaction work. Use package size as one recorded
input, not as a conversion factor to instructions.

For threshold work, repeat the same deterministic fixture with several package
shapes and record at least:

- packed archive bytes;
- mutable asset/file count;
- staged copy count;
- clear-prefix count;
- relevant chunk/content totals; and
- measured `Prim.performanceCounter(0)` result.

## Failure interpretation

- A normal successful commit means the instrumentation was not present in the
  actor that actually executed. Re-check the installed-module baseline; changing
  checkout Kernel source is insufficient for an app-only update.
- A failure before `commit-assets` is not a commit-cost measurement. Fix the
  package/provision/compiler/setup problem first.
- A missing or malformed diagnostic prefix means the intended instrumented path
  did not reach the post-commit sample.
- A cycle-balance-derived negative or unexpectedly signed value is not evidence;
  discard it and use the performance counter method.

## Cleanup

After recording the result:

- preserve durable package-specific evidence in the owning Issue or regression;
- remove the temporary workflow/script and diagnostic branch;
- do not merge the instrumented Kernel source;
- do not copy the diagnostic trap into production code; and
- leave the normal package installer and commit semantics unchanged.

## Relevant sources

- `packages/neutron-compiler/src/install.ts`
- `packages/neutron-compiler/src/compile.ts`
- `apps/kernel/backend/install/`
- [`Compiler And Actor Assembly`](./compiler-and-actor-assembly.md#install-transaction)
- [`App Package Updates`](./package-updates.md#atomic-update-deployment)

The current package-specific investigation that motivated this procedure is
tracked in GitHub Issue #373. The Issue owns measurements and remediation;
this document owns only the reusable diagnostic method.
