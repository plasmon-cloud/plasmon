import type {
  AssociationRule,
  HandlerDefinition,
  NativeAppDefinition,
} from "../../os/contracts/index.ts";
import type { NativeAppLoader } from "../../os/process/runtime.ts";
import { EMULATORJS_NES_MIME } from "./runtime.ts";

const icon = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='10' fill='%23171b20' stroke='%236a7482'/%3E%3Cpath d='M19 24h26v18H19z' fill='none' stroke='%23f2f2f2' stroke-width='3'/%3E%3Cpath d='M25 30v6M22 33h6' stroke='%23f2f2f2' stroke-width='2'/%3E%3Ccircle cx='38' cy='31' r='2' fill='%23f2f2f2'/%3E%3Ccircle cx='42' cy='35' r='2' fill='%23f2f2f2'/%3E%3C/svg%3E";

/** Association-backed runtime metadata. This is not a filesystem .sys application. */
export const emulatorJsHandler: HandlerDefinition = {
  id: "runtime:emulatorjs",
  kind: "native",
  name: "EmulatorJS",
  icon,
  capabilities: ["read"],
};

export const emulatorJsAssociationRules: AssociationRule[] = [
  {
    id: "runtime:emulatorjs:nes",
    handlerId: emulatorJsHandler.id,
    extensions: [".nes"],
    mimeTypes: [EMULATORJS_NES_MIME],
    priority: 250,
  },
];

export const emulatorJsRuntimeDefinition: NativeAppDefinition = {
  id: "runtime:emulatorjs",
  handlerId: emulatorJsHandler.id,
  name: "EmulatorJS",
  icon,
  singleton: false,
  runtimeOnly: true,
  defaultWindow: {
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 420,
  },
  associations: emulatorJsAssociationRules,
};

export function createEmulatorJsRuntimeLoader(): NativeAppLoader {
  return () => import("./EmulatorJsPlayer.tsx");
}
