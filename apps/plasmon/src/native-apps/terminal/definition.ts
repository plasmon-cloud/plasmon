import type { AssociationRule, HandlerDefinition, NativeAppDefinition } from "../../os/contracts/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";

export const terminalHandler: HandlerDefinition = {
  id: "native:terminal",
  kind: "native",
  name: "Terminal",
  icon: SYSTEM_ICON_ASSETS.terminal,
  capabilities: ["read"],
};

export const terminalAssociationRules: AssociationRule[] = [
  { id: "native:terminal:cmd", handlerId: "native:terminal", extensions: [".cmd"], priority: 320 },
  { id: "native:terminal:run", handlerId: "native:terminal", extensions: [".run"], priority: 320 },
];

export const terminalAppDefinition: NativeAppDefinition = {
  id: "native:terminal",
  handlerId: "native:terminal",
  name: "Terminal",
  icon: terminalHandler.icon,
  singleton: false,
  defaultWindow: { width: 760, height: 480, minWidth: 460, minHeight: 280 },
  associations: terminalAssociationRules,
};
