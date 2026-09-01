import type { FsNode, HandlerId, JsonValue } from "../contracts/index.ts";

export const OWNERSHIP_METADATA_KEY = "plasmon.ownership";
export const SYSTEM_APP_METADATA_KEY = "plasmon.systemApp";
export const NEUTRON_APP_METADATA_KEY = "plasmon.neutronApp";
export const SYSTEM_APP_MIME = "application/x-plasmon-system-app";
export const NEUTRON_APP_MIME = "application/x-plasmon-neutron-app";
export const CONFIGURATION_FILE_METADATA_KEY = "plasmon.configurationFile";

export interface ConfigurationFileResourceMetadata {
  format: "plasmon.configuration-file";
  version: 1;
  owner: string;
  schema: string;
  schemaVersion: number;
}

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

export type ResourceContentKind =
  | "text"
  | "source"
  | "markdown"
  | "image"
  | "audio"
  | "video"
  | "unknown";

export type ResourceTypeSource = "explicit-mime" | "filename" | "fallback";

export interface ResourceTypeClassification {
  extension: string;
  mime: string | null;
  contentKind: ResourceContentKind;
  language: string | null;
  source: ResourceTypeSource;
}

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
  type: ResourceTypeClassification;
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

type ClassifiableResource = Pick<FsNode, "name" | "kind" | "metadata"> & { mime?: string | undefined };

type TypeHint = Readonly<{
  mime: string;
  contentKind: Exclude<ResourceContentKind, "unknown">;
  language: string | null;
}>;

const TYPE_BY_EXTENSION: Readonly<Record<string, TypeHint>> = Object.freeze({
  ".txt": { mime: "text/plain", contentKind: "text", language: "plaintext" },
  ".log": { mime: "text/plain", contentKind: "text", language: "plaintext" },
  ".md": { mime: "text/markdown", contentKind: "markdown", language: "markdown" },
  ".markdown": { mime: "text/markdown", contentKind: "markdown", language: "markdown" },
  ".json": { mime: "application/json", contentKind: "source", language: "json" },
  ".js": { mime: "application/javascript", contentKind: "source", language: "javascript" },
  ".cjs": { mime: "application/javascript", contentKind: "source", language: "javascript" },
  ".mjs": { mime: "application/javascript", contentKind: "source", language: "javascript" },
  ".jsx": { mime: "application/javascript", contentKind: "source", language: "javascript" },
  ".ts": { mime: "text/typescript", contentKind: "source", language: "typescript" },
  ".cts": { mime: "text/typescript", contentKind: "source", language: "typescript" },
  ".mts": { mime: "text/typescript", contentKind: "source", language: "typescript" },
  ".tsx": { mime: "text/typescript", contentKind: "source", language: "typescript" },
  ".run": { mime: "text/typescript", contentKind: "source", language: "typescript" },
  ".cmd": { mime: "application/x-sh", contentKind: "source", language: "shell" },
  ".css": { mime: "text/css", contentKind: "source", language: "css" },
  ".scss": { mime: "text/x-scss", contentKind: "source", language: "scss" },
  ".html": { mime: "text/html", contentKind: "source", language: "html" },
  ".htm": { mime: "text/html", contentKind: "source", language: "html" },
  ".xml": { mime: "application/xml", contentKind: "source", language: "xml" },
  ".yaml": { mime: "application/yaml", contentKind: "source", language: "yaml" },
  ".yml": { mime: "application/yaml", contentKind: "source", language: "yaml" },
  ".toml": { mime: "application/toml", contentKind: "source", language: "ini" },
  ".rs": { mime: "text/x-rust", contentKind: "source", language: "rust" },
  ".py": { mime: "text/x-python", contentKind: "source", language: "python" },
  ".go": { mime: "text/x-go", contentKind: "source", language: "go" },
  ".java": { mime: "text/x-java-source", contentKind: "source", language: "java" },
  ".c": { mime: "text/x-c", contentKind: "source", language: "c" },
  ".cc": { mime: "text/x-c++src", contentKind: "source", language: "cpp" },
  ".cpp": { mime: "text/x-c++src", contentKind: "source", language: "cpp" },
  ".cxx": { mime: "text/x-c++src", contentKind: "source", language: "cpp" },
  ".h": { mime: "text/x-c++src", contentKind: "source", language: "cpp" },
  ".hpp": { mime: "text/x-c++src", contentKind: "source", language: "cpp" },
  ".sh": { mime: "application/x-sh", contentKind: "source", language: "shell" },
  ".sql": { mime: "application/sql", contentKind: "source", language: "sql" },
  ".ini": { mime: "text/plain", contentKind: "source", language: "ini" },
  ".conf": { mime: "text/plain", contentKind: "source", language: "plaintext" },
  ".png": { mime: "image/png", contentKind: "image", language: null },
  ".jpg": { mime: "image/jpeg", contentKind: "image", language: null },
  ".jpeg": { mime: "image/jpeg", contentKind: "image", language: null },
  ".webp": { mime: "image/webp", contentKind: "image", language: null },
  ".gif": { mime: "image/gif", contentKind: "image", language: null },
  ".bmp": { mime: "image/bmp", contentKind: "image", language: null },
  ".svg": { mime: "image/svg+xml", contentKind: "image", language: "xml" },
  ".heic": { mime: "image/heic", contentKind: "image", language: null },
  ".heif": { mime: "image/heif", contentKind: "image", language: null },
  ".mp3": { mime: "audio/mpeg", contentKind: "audio", language: null },
  ".wav": { mime: "audio/wav", contentKind: "audio", language: null },
  ".flac": { mime: "audio/flac", contentKind: "audio", language: null },
  ".m4a": { mime: "audio/mp4", contentKind: "audio", language: null },
  ".aac": { mime: "audio/aac", contentKind: "audio", language: null },
  ".opus": { mime: "audio/opus", contentKind: "audio", language: null },
  ".mp4": { mime: "video/mp4", contentKind: "video", language: null },
  ".m4v": { mime: "video/mp4", contentKind: "video", language: null },
  ".webm": { mime: "video/webm", contentKind: "video", language: null },
  ".mov": { mime: "video/quicktime", contentKind: "video", language: null },
  ".ogv": { mime: "video/ogg", contentKind: "video", language: null },
  ".ogg": { mime: "video/ogg", contentKind: "video", language: null },
  ".avi": { mime: "video/x-msvideo", contentKind: "video", language: null },
  ".mkv": { mime: "video/x-matroska", contentKind: "video", language: null },
});

const SOURCE_BY_MIME: Readonly<Record<string, string>> = Object.freeze({
  "application/json": "json",
  "application/javascript": "javascript",
  "application/ecmascript": "javascript",
  "text/javascript": "javascript",
  "text/typescript": "typescript",
  "text/css": "css",
  "text/x-scss": "scss",
  "text/html": "html",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/yaml": "yaml",
  "application/x-yaml": "yaml",
  "text/yaml": "yaml",
  "application/toml": "ini",
  "text/x-rust": "rust",
  "text/x-python": "python",
  "text/x-go": "go",
  "text/x-java-source": "java",
  "text/x-c": "c",
  "text/x-c++src": "cpp",
  "application/x-sh": "shell",
  "application/sql": "sql",
});

function record(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function nonEmptyString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extension(name: string): string {
  const normalized = name.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot > 0 ? normalized.slice(dot) : "";
}

function normalizedMime(value: string): string {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}

function explicitType(extensionValue: string, mime: string): ResourceTypeClassification {
  if (mime === "text/markdown") {
    return { extension: extensionValue, mime, contentKind: "markdown", language: "markdown", source: "explicit-mime" };
  }
  if (mime.startsWith("image/")) {
    return { extension: extensionValue, mime, contentKind: "image", language: mime === "image/svg+xml" ? "xml" : null, source: "explicit-mime" };
  }
  if (mime.startsWith("audio/")) {
    return { extension: extensionValue, mime, contentKind: "audio", language: null, source: "explicit-mime" };
  }
  if (mime.startsWith("video/")) {
    return { extension: extensionValue, mime, contentKind: "video", language: null, source: "explicit-mime" };
  }
  const sourceLanguage = SOURCE_BY_MIME[mime];
  if (sourceLanguage) {
    return { extension: extensionValue, mime, contentKind: "source", language: sourceLanguage, source: "explicit-mime" };
  }
  if (mime.startsWith("text/")) {
    return { extension: extensionValue, mime, contentKind: "text", language: "plaintext", source: "explicit-mime" };
  }
  return { extension: extensionValue, mime, contentKind: "unknown", language: null, source: "explicit-mime" };
}

function filenameType(extensionValue: string, inferred: TypeHint): ResourceTypeClassification {
  return {
    extension: extensionValue,
    mime: inferred.mime,
    contentKind: inferred.contentKind,
    language: inferred.language,
    source: "filename",
  };
}

function classifyType(node: Pick<ClassifiableResource, "name" | "mime">): ResourceTypeClassification {
  const extensionValue = extension(node.name);
  const inferred = TYPE_BY_EXTENSION[extensionValue];
  const declared = node.mime?.trim();
  if (declared) {
    const mime = normalizedMime(declared);
    // `text/plain` is a generic text transport/fallback rather than a stronger
    // source-language identity. Older Plasmon Text/FileManager paths persisted
    // it before a later filename mutation, so allow a recognized source suffix
    // to refine that one generic MIME. Specific explicit MIME remains stronger.
    if (mime === "text/plain" && inferred?.contentKind === "source") {
      return filenameType(extensionValue, inferred);
    }
    return explicitType(extensionValue, mime);
  }
  if (inferred) return filenameType(extensionValue, inferred);
  return { extension: extensionValue, mime: null, contentKind: "unknown", language: null, source: "fallback" };
}

export function resourceOwnership(node: Pick<ClassifiableResource, "metadata">): ResourceOwnership {
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

export function readSystemAppMetadata(node: ClassifiableResource): SystemAppMetadata | null {
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

export function readConfigurationFileMetadata(node: ClassifiableResource): ConfigurationFileResourceMetadata | null {
  if (node.kind !== "file") return null;
  const value = record(node.metadata[CONFIGURATION_FILE_METADATA_KEY]);
  if (
    !value
    || value.format !== "plasmon.configuration-file"
    || value.version !== 1
    || typeof value.owner !== "string"
    || typeof value.schema !== "string"
    || typeof value.schemaVersion !== "number"
    || !Number.isSafeInteger(value.schemaVersion)
  ) return null;
  return {
    format: "plasmon.configuration-file",
    version: 1,
    owner: value.owner,
    schema: value.schema,
    schemaVersion: value.schemaVersion,
  };
}

export function readNeutronAppMetadata(node: ClassifiableResource): NeutronAppMetadata | null {
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

/**
 * Canonical resource classifier.
 *
 * Specific persisted semantic/MIME metadata remains authoritative. Filename
 * inference is deterministic derived state and otherwise applies when no
 * explicit MIME is present. The one compatibility refinement is generic
 * `text/plain` on a recognized source filename: that MIME carries no language
 * identity and historically could be persisted by Plasmon before a rename, so
 * the source suffix owns the effective source MIME/language. Association/default-
 * open and visual presentation policy are not part of this result.
 */
export function classifyResource(node: ClassifiableResource): ResourceClassification {
  const systemApp = readSystemAppMetadata(node);
  const neutronApp = readNeutronAppMetadata(node);
  const ownership = resourceOwnership(node);
  const type = classifyType(node);
  if (systemApp) return { kind: "system-app", ownership, systemApp, neutronApp: null, type };
  if (neutronApp) return { kind: "neutron-app", ownership, systemApp: null, neutronApp, type };
  if (node.kind === "directory") return { kind: "directory", ownership, systemApp: null, neutronApp: null, type };
  if (node.kind === "shortcut") return { kind: "shortcut", ownership, systemApp: null, neutronApp: null, type };
  if (node.kind === "atom") return { kind: "atom", ownership, systemApp: null, neutronApp: null, type };
  return { kind: "ordinary-file", ownership, systemApp: null, neutronApp: null, type };
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