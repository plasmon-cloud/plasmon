import type { FsNode, HandlerId, JsonValue } from "../contracts/index.ts";

export const OWNERSHIP_METADATA_KEY = "plasmon.ownership";
export const SYSTEM_APP_METADATA_KEY = "plasmon.systemApp";
export const NEUTRON_APP_METADATA_KEY = "plasmon.neutronApp";
export const SYSTEM_APP_MIME = "application/x-plasmon-system-app";
export const NEUTRON_APP_MIME = "application/x-plasmon-neutron-app";

export type ResourceOwnership =
  | "system-required"
  | "seeded-default"
  | "demo-temporary"
  | "installed-app-projection"
  | "user";

export type ResourceSemanticKind =
  | "directory"
  | "ordinary-file"
  | "shortcut"
  | "atom"
  | "system-app"
  | "neutron-app";

export interface SystemAppMetadata {
  format: "plasmon.system-app";
  version: 1;
  systemId: string;
  handlerId: HandlerId;
}

export interface NeutronAppMetadata {
  format: "plasmon-neutron-app";
  version: 1;
  elementId: string;
  name?: string;
  description?: string;
  appVersion?: number;
  icon?: string;
}

export interface ResourceClassification {
  kind: ResourceSemanticKind;
  ownership: ResourceOwnership;
  systemApp: SystemAppMetadata | null;
  neutronApp: NeutronAppMetadata | null;
}

export type ResourceOperation =
  | "open"
  | "rename"
  | "move"
  | "copy"
  | "delete"
  | "uninstall"
  | "create-shortcut"
  | "pin"
  | "download"
  | "properties"
  | "search";

export interface ResourceCapabilities {
  open: boolean;
  rename: boolean;
  move: boolean;
  copy: boolean;
  delete: boolean;
  uninstall: boolean;
  createShortcut: boolean;
  pin: boolean;
  download: boolean;
  properties: boolean;
  search: boolean;
}

function record(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function nonEmptyString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function resourceOwnership(node: FsNode): ResourceOwnership {
  const value = node.metadata[OWNERSHIP_METADATA_KEY];
  switch (value) {
    case "system-required":
    case "seeded-default":
    case "demo-temporary":
    case "installed-app-projection":
    case "user":
      return value;
    default:
      return "user";
  }
}

export function readSystemAppMetadata(node: FsNode): SystemAppMetadata | null {
  if (node.kind !== "file" || node.mime !== SYSTEM_APP_MIME) return null;
  const value = record(node.metadata[SYSTEM_APP_METADATA_KEY]);
  if (!value || value.format !== "plasmon.system-app" || value.version !== 1) return null;
  const systemId = nonEmptyString(value.systemId);
  const handlerId = nonEmptyString(value.handlerId);
  if (!systemId || !handlerId) return null;
  return {
    format: "plasmon.system-app",
    version: 1,
    systemId,
    handlerId,
  };
}

export function readNeutronAppMetadata(node: FsNode): NeutronAppMetadata | null {
  if (node.kind !== "file" || node.mime !== NEUTRON_APP_MIME) return null;
  const value = record(node.metadata[NEUTRON_APP_METADATA_KEY]);
  if (!value || value.format !== "plasmon-neutron-app" || value.version !== 1) return null;
  const elementId = nonEmptyString(value.elementId);
  if (!elementId) return null;
  const name = nonEmptyString(value.name) ?? undefined;
  const description = nonEmptyString(value.description) ?? undefined;
  const icon = nonEmptyString(value.icon) ?? undefined;
  const appVersion = typeof value.appVersion === "number" && Number.isSafeInteger(value.appVersion)
    ? value.appVersion
    : undefined;
  return {
    format: "plasmon-neutron-app",
    version: 1,
    elementId,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(appVersion === undefined ? {} : { appVersion }),
    ...(icon ? { icon } : {}),
  };
}

export function classifyResource(node: FsNode): ResourceClassification {
  const systemApp = readSystemAppMetadata(node);
  const neutronApp = readNeutronAppMetadata(node);
  const ownership = resourceOwnership(node);
  if (systemApp) return { kind: "system-app", ownership, systemApp, neutronApp: null };
  if (neutronApp) return { kind: "neutron-app", ownership, systemApp: null, neutronApp };
  if (node.kind === "directory") return { kind: "directory", ownership, systemApp: null, neutronApp: null };
  if (node.kind === "shortcut") return { kind: "shortcut", ownership, systemApp: null, neutronApp: null };
  if (node.kind === "atom") return { kind: "atom", ownership, systemApp: null, neutronApp: null };
  return { kind: "ordinary-file", ownership, systemApp: null, neutronApp: null };
}

export function resourceCapabilities(node: FsNode): ResourceCapabilities {
  const classification = classifyResource(node);
  const systemRequired = classification.ownership === "system-required";

  if (classification.kind === "system-app") {
    return {
      open: true,
      rename: false,
      move: false,
      copy: false,
      delete: false,
      uninstall: false,
      createShortcut: true,
      pin: true,
      download: false,
      properties: true,
      search: true,
    };
  }

  if (classification.kind === "neutron-app") {
    return {
      open: true,
      rename: false,
      move: false,
      copy: false,
      delete: false,
      uninstall: false,
      createShortcut: true,
      pin: true,
      download: false,
      properties: true,
      search: true,
    };
  }

  if (systemRequired) {
    return {
      open: true,
      rename: false,
      move: false,
      copy: false,
      delete: false,
      uninstall: false,
      createShortcut: true,
      pin: true,
      download: false,
      properties: true,
      search: !node.name.startsWith("."),
    };
  }

  if (classification.kind === "directory") {
    return {
      open: true,
      rename: true,
      move: true,
      copy: true,
      delete: true,
      uninstall: false,
      createShortcut: true,
      pin: true,
      download: false,
      properties: true,
      search: true,
    };
  }

  if (classification.kind === "shortcut") {
    return {
      open: true,
      rename: true,
      move: true,
      copy: true,
      delete: true,
      uninstall: false,
      createShortcut: true,
      pin: true,
      download: false,
      properties: true,
      search: true,
    };
  }

  return {
    open: true,
    rename: true,
    move: true,
    copy: classification.kind !== "atom",
    delete: true,
    uninstall: false,
    createShortcut: true,
    pin: true,
    download: classification.kind !== "atom",
    properties: true,
    search: true,
  };
}

export function canResourceOperation(node: FsNode, operation: ResourceOperation): boolean {
  const capabilities = resourceCapabilities(node);
  switch (operation) {
    case "open": return capabilities.open;
    case "rename": return capabilities.rename;
    case "move": return capabilities.move;
    case "copy": return capabilities.copy;
    case "delete": return capabilities.delete;
    case "uninstall": return capabilities.uninstall;
    case "create-shortcut": return capabilities.createShortcut;
    case "pin": return capabilities.pin;
    case "download": return capabilities.download;
    case "properties": return capabilities.properties;
    case "search": return capabilities.search;
  }
}

export function systemAppMetadata(systemId: string, handlerId: HandlerId): Record<string, JsonValue> {
  return {
    [OWNERSHIP_METADATA_KEY]: "system-required",
    [SYSTEM_APP_METADATA_KEY]: {
      format: "plasmon.system-app",
      version: 1,
      systemId,
      handlerId,
    },
  };
}

export function neutronAppMetadata(input: Omit<NeutronAppMetadata, "format" | "version">): Record<string, JsonValue> {
  return {
    [OWNERSHIP_METADATA_KEY]: "installed-app-projection",
    [NEUTRON_APP_METADATA_KEY]: {
      format: "plasmon-neutron-app",
      version: 1,
      elementId: input.elementId,
      ...(input.name ? { name: input.name } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.appVersion === undefined ? {} : { appVersion: input.appVersion }),
      ...(input.icon ? { icon: input.icon } : {}),
    },
  };
}
