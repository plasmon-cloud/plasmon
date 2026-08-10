import { createElement } from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  NativeAppDefinition,
  OpenService,
} from "../../os/contracts/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";

export type { PropertiesAppProps } from "./PropertiesApp.tsx";

export const propertiesAppDefinition: NativeAppDefinition = {
  id: "native:properties",
  handlerId: "native:properties",
  name: "Properties",
  icon: "system:properties",
  singleton: false,
  defaultWindow: { width: 610, height: 590, minWidth: 480, minHeight: 400 },
  associations: [],
};

export interface PropertiesNativeDependencies {
  fsEvents?: FsEventSource;
  associations: AssociationRegistry;
  openService: OpenService;
}

export function createPropertiesNativeLoader(dependencies: PropertiesNativeDependencies): NativeAppLoader {
  return async () => {
    const { PropertiesApp } = await import("./PropertiesApp.tsx");
    const Component: NativeAppComponent = (props) => createElement(PropertiesApp, {
      ...props,
      associations: dependencies.associations,
      openService: dependencies.openService,
      ...(dependencies.fsEvents ? { fsEvents: dependencies.fsEvents } : {}),
    });
    return { default: Component };
  };
}
