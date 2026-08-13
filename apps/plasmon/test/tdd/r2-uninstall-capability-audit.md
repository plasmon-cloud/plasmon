# #46 vanilla Neutron uninstall capability audit

**Disposition: CLOSURE AUDIT COMPLETE / BLOCKED EXTERNAL CAPABILITY.** This audit does not implement or expose Uninstall in Plasmon.

## Current authoritative capability

The integrated release contains two distinct layers:

1. **Kernel-owned uninstall exists.** `apps/kernel/src/workspace/Launcher.tsx` and `apps/kernel/src/settings/KernelSettingsPage.tsx` call `requestAppUninstall(...)` and then `uninstall_app(appId)`. `apps/kernel/src/reducer/apps.ts` performs the checked uninstall compilation/deployment. `packages/neutron-compiler/src/install.ts` rejects removing the kernel, checks installed dependents, stages removed app prefixes, and produces the uninstall plan. `apps/kernel/src/AppDialogs.tsx` owns confirmation/progress UI.
2. **Ordinary application-facing request capability is absent.** `apps/plasmon/src/os/contracts/neutron.ts` / `NeutronBridge` expose discovery, open, install offer, refresh, and subscription, but no uninstall method. `packages/neutron-tools` exposes the source-bound `apps.install_offer` capability; no `apps.uninstall`/removal request tool or SDK helper exists. Kernel `uninstall_app` is frontend/orchestration authority, not an application capability.

The distinction matters: “Neutron can uninstall” is not evidence that a Plasmon-hosted ordinary application can request uninstall.

## Exact boundary and deterministic Plasmon contract

Plasmon can truthfully and permanently test now:

- `.neutron` projections have `uninstall: false` in `src/os/fs/resourcePolicy.ts` and are protected from generic `FsService.remove()`;
- attempted FileManager Delete returns the canonical “use Uninstall instead” error (`test/fileManagerDelete.test.ts`);
- `/Apps` is a projection of authoritative discovery, not installation authority;
- after an externally authoritative install-set refresh removes an Element, filesystem reconciliation removes its projection without local optimistic deletion (existing `managedRootBootstrap`/projection tests);
- unknown runtime state must not be interpreted as uninstalled.

Plasmon cannot truthfully test a successful user-facing uninstall request until Neutron exposes a bounded, authenticated, Kernel-owned request boundary. The missing capability must preserve Kernel confirmation, provider-dependent uninstall checks, destructive memory/app-prefix cleanup, deployment progress/failure semantics, and post-commit discovery invalidation.

## Evidence conclusion

- Kernel source/tests prove the administrative uninstall lifecycle and its restrictions.
- Plasmon source/docs already record the absence of the ordinary app-facing API (`apps/plasmon/src/os/neutron/README.md`, `FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`, parity ledger).
- No Plasmon UI or fake bridge was added. No `/Apps` deletion is a substitute.

**Follow-up:** Neutron/Kernel must define and expose the request boundary, or explicitly decide that Plasmon cannot offer this command. Only then should a separate Plasmon bridge/UI Issue be created. #46 itself has no remaining honest Plasmon RED beyond this external capability decision.
