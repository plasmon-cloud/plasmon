import { createElement } from "react";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import type { ScriptingService } from "../../scripting/service.ts";
import {
  terminalAppDefinition,
  terminalAssociationRules,
  terminalHandler,
} from "./definition.ts";

export { terminalAppDefinition, terminalAssociationRules, terminalHandler } from "./definition.ts";

export interface TerminalNativeDependencies { scripting: ScriptingService; }

export function createTerminalNativeLoader(dependencies: TerminalNativeDependencies): NativeAppLoader {
  const loadTerminal = () => import("./Terminal.tsx");
  return async () => {
    const { TerminalApp } = await loadTerminal();
    const Component: NativeAppComponent = (props) => createElement(TerminalApp, { ...props, scripting: dependencies.scripting });
    return { default: Component };
  };
}
