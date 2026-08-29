import { createElement } from "react";
import type { NativeAppDefinition } from "../../os/contracts/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";
import type { ScriptingService } from "../../scripting/service.ts";

export const terminalAppDefinition: NativeAppDefinition = {
  id: "native:terminal",
  handlerId: "native:terminal",
  name: "Terminal",
  icon: SYSTEM_ICON_ASSETS.terminal,
  singleton: false,
  defaultWindow: { width: 760, height: 480, minWidth: 460, minHeight: 280 },
  associations: [],
};

export interface TerminalNativeDependencies {
  scripting: ScriptingService;
}

export function createTerminalNativeLoader(dependencies: TerminalNativeDependencies): NativeAppLoader {
  return async () => {
    const { TerminalApp } = await import("./Terminal.tsx");
    const Component: NativeAppComponent = (props) => createElement(TerminalApp, {
      ...props,
      scripting: dependencies.scripting,
    });
    return { default: Component };
  };
}
