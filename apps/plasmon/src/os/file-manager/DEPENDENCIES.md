# Agent 5 integration dependencies

No external npm dependency is required. The implementation uses the existing React/browser stack.

Coordinator A integration requirements:

1. Register `explorerAppDefinition` with `createExplorerNativeLoader(...)` and `propertiesAppDefinition` with `createPropertiesNativeLoader(...)` on the existing `NativeApplicationRegistry`; do not create another registry/controller/window manager.
2. Supply the accepted Wave 1 `AssociationRegistry`, `OpenService`, and `FsEventSource` to those loader factories. `createPlasmonServices()` currently does not expose/compose the association/open services, so that wiring belongs in Agent 0's integration-owned path.
3. Mount `Desktop` from `src/os/desktop/index.ts` in the integration-owned Plasmon OS composition root with the real `FsService`, `FsEventSource`, `ProcessController`, association/open services, and preferably one explicit shared `FileOperationClipboard` if clipboard continuity is desired between Desktop and Explorer windows.
4. No frozen contract change is required for any of the above.
