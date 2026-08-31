import { createPlasmonOsApi } from "../os/api/adapter.ts";
import type { PlasmonServices } from "../os/integration/services.ts";
import { createTerminalNativeLoader, type TerminalNativeDependencies } from "../native-apps/terminal/index.ts";
import { ScriptingService } from "./service.ts";

export interface ScriptingIntegration {
  readonly scripting: ScriptingService;
  readonly terminalLoader: ReturnType<typeof createTerminalNativeLoader>;
}

export function createScriptingIntegration(services: PlasmonServices): ScriptingIntegration {
  const scripting = new ScriptingService({ os: createPlasmonOsApi({ services }) });
  const dependencies: TerminalNativeDependencies = { scripting };
  return {
    scripting,
    terminalLoader: createTerminalNativeLoader(dependencies),
  };
}
