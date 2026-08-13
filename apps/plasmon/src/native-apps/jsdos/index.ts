import type {
  AssociationRule,
  HandlerDefinition,
  NativeAppDefinition,
} from "../../os/contracts/index.ts";
import type { NativeAppLoader } from "../../os/process/runtime.ts";

const icon = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='10' fill='%23171b20' stroke='%236a7482'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='monospace' font-size='22' font-weight='700' fill='%23f2f2f2'%3EDOS%3C/text%3E%3C/svg%3E";

/** Association handler metadata. This is not a filesystem .sys application. */
export const jsDosHandler: HandlerDefinition = {
  id: "runtime:js-dos",
  kind: "native",
  name: "js-dos",
  icon,
  capabilities: ["read"],
};

export const jsDosAssociationRules: AssociationRule[] = [
  {
    id: "runtime:js-dos:bundle",
    handlerId: jsDosHandler.id,
    extensions: [".jsdos"],
    mimeTypes: ["application/x-jsdos"],
    priority: 260,
  },
];

/**
 * Process-host metadata required by the current OpenService/NativeProcessHost.
 * It creates a Plasmon window for the runtime handler; it does not create or
 * represent DOS.sys, Emulator.sys, Games.sys, or any other filesystem app.
 */
export const jsDosRuntimeDefinition: NativeAppDefinition = {
  id: "runtime:js-dos",
  handlerId: jsDosHandler.id,
  name: "js-dos",
  icon,
  singleton: false,
  runtimeOnly: true,
  defaultWindow: {
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 420,
  },
  associations: jsDosAssociationRules,
};

export function createJsDosRuntimeLoader(): NativeAppLoader {
  return () => import("./JsDosPlayer.tsx");
}
