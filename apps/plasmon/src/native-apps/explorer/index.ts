import { createElement } from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  NativeAppDefinition,
  OpenService,
} from "../../os/contracts/index.ts";
import type { HiddenVisibilityPreferenceStore } from "../../os/hiddenVisibility.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import type {
  FileManagerOpenAuthority,
  FileManagerTrashAuthority,
  FileOperationClipboard,
} from "../../os/file-manager/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";

export type { ExplorerAppProps } from "./ExplorerApp.tsx";
export * from "./history.ts";

export const explorerAppDefinition: NativeAppDefinition = {
  id: "native:explorer",
  handlerId: "native:explorer",
  name: "Files",
  icon: SYSTEM_ICON_ASSETS["file-manager"],
  singleton: false,
  defaultWindow: { width: 960, height: 650, minWidth: 640, minHeight: 420 },
  associations: [],
};

export interface ExplorerNativeDependencies {
  fsEvents?: FsEventSource;
  associations: AssociationRegistry;
  openService: OpenService;
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
  clipboard?: FileOperationClipboard;
  hiddenVisibility: HiddenVisibilityPreferenceStore;
}

export function createExplorerNativeLoader(dependencies: ExplorerNativeDependencies): NativeAppLoader {
  return async () => {
    const { ExplorerApp } = await import("./ExplorerApp.tsx");
    const Component: NativeAppComponent = (props) => createElement(ExplorerApp, {
      ...props,
      associations: dependencies.associations,
      openService: dependencies.openService,
      openAuthority: dependencies.openAuthority,
      trashAuthority: dependencies.trashAuthority,
      hiddenVisibility: dependencies.hiddenVisibility,
      ...(dependencies.fsEvents ? { fsEvents: dependencies.fsEvents } : {}),
      ...(dependencies.clipboard ? { clipboard: dependencies.clipboard } : {}),
    });
    return { default: Component };
  };
}
