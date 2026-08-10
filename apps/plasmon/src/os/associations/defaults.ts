import type { HandlerId } from "../contracts/index.ts";

export interface AssociationDefaultStore {
  get(typeKey: string): Promise<HandlerId | null>;
  set(typeKey: string, handlerId: HandlerId): Promise<void>;
  delete(typeKey: string): Promise<void>;
}

export class MemoryAssociationDefaultStore implements AssociationDefaultStore {
  private readonly defaults = new Map<string, HandlerId>();

  async get(typeKey: string): Promise<HandlerId | null> {
    return this.defaults.get(typeKey) ?? null;
  }

  async set(typeKey: string, handlerId: HandlerId): Promise<void> {
    this.defaults.set(typeKey, handlerId);
  }

  async delete(typeKey: string): Promise<void> {
    this.defaults.delete(typeKey);
  }
}

export class LocalStorageAssociationDefaultStore implements AssociationDefaultStore {
  private readonly storage: Storage;
  private readonly prefix: string;

  constructor(storage?: Storage, prefix = "plasmon.association.default.") {
    const resolved = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!resolved) throw new Error("localStorage is unavailable in this environment");
    this.storage = resolved;
    this.prefix = prefix;
  }

  async get(typeKey: string): Promise<HandlerId | null> {
    return this.storage.getItem(`${this.prefix}${typeKey}`);
  }

  async set(typeKey: string, handlerId: HandlerId): Promise<void> {
    this.storage.setItem(`${this.prefix}${typeKey}`, handlerId);
  }

  async delete(typeKey: string): Promise<void> {
    this.storage.removeItem(`${this.prefix}${typeKey}`);
  }
}

export const associationTypeKey = {
  extension(extension: string): string {
    return `extension:${normalizeExtension(extension)}`;
  },
  mime(mime: string): string {
    return `mime:${normalizeMime(mime)}`;
  },
  atomType(atomType: string): string {
    const normalized = atomType.trim();
    if (!normalized) throw new Error("Atom type cannot be empty");
    return `atom:${normalized}`;
  },
} as const;

export function normalizeAssociationTypeKey(typeKey: string): string {
  const separator = typeKey.indexOf(":");
  if (separator <= 0) throw new Error(`Malformed association type key: ${typeKey}`);
  const kind = typeKey.slice(0, separator);
  const value = typeKey.slice(separator + 1);
  if (kind === "extension") return associationTypeKey.extension(value);
  if (kind === "mime") return associationTypeKey.mime(value);
  if (kind === "atom") return associationTypeKey.atomType(value);
  throw new Error(`Unsupported association type key: ${typeKey}`);
}

export function normalizeExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) throw new Error("Extension cannot be empty");
  if (/[\\/\s*?]/.test(trimmed)) throw new Error(`Malformed extension: ${extension}`);
  const normalized = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  if (normalized === "." || normalized.includes("..")) throw new Error(`Malformed extension: ${extension}`);
  return normalized;
}

export function normalizeMime(mime: string): string {
  const normalized = mime.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!/^(?:\*|[a-z0-9!#$&^_.+-]+)\/(?:\*|[a-z0-9!#$&^_.+-]+)$/.test(normalized)) {
    throw new Error(`Malformed MIME type: ${mime}`);
  }
  if (normalized.startsWith("*/") && normalized !== "*/*") throw new Error(`Malformed MIME wildcard: ${mime}`);
  return normalized;
}
