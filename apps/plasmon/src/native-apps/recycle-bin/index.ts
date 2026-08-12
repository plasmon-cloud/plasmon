import { createElement } from "react";
import type { FsEventSource, NativeAppDefinition } from "../../os/contracts/index.ts";
import type { FilesystemTrashService } from "../../os/fs/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";

export * from "./model.ts";
export type { RecycleBinProps } from "./RecycleBin.tsx";

export const recycleBinAppDefinition: NativeAppDefinition = {
  id: "native:recycle-bin",
  handlerId: "native:recycle-bin",
  name: "Recycle Bin",
  icon: SYSTEM_ICON_ASSETS["recycle-bin"],
  singleton: true,
  defaultWindow: { width: 860, height: 560, minWidth: 620, minHeight: 380 },
  associations: [],
};

export interface RecycleBinNativeDependencies {
  trash: FilesystemTrashService;
  fsEvents?: FsEventSource;
}

export function createRecycleBinNativeLoader(
  dependencies: RecycleBinNativeDependencies,
): NativeAppLoader {
  return async () => {
    const { RecycleBin } = await import("./RecycleBin.tsx");
    const Component: NativeAppComponent = (props) => createElement(RecycleBin, {
      ...props,
      trash: dependencies.trash,
      ...(dependencies.fsEvents ? { fsEvents: dependencies.fsEvents } : {}),
    });
    return { default: Component };
  };
}
