import type { AtomDescriptor, FsNode, JsonValue } from "../contracts/index.ts";

export type AtomParseErrorCode = "invalid_json" | "invalid_descriptor";
export interface AtomParseError { code: AtomParseErrorCode; message: string; }
export type AtomParseResult = { ok: true; descriptor: AtomDescriptor } | { ok: false; error: AtomParseError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return typeof value !== "number" || Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function invalid(message: string): AtomParseResult {
  return { ok: false, error: { code: "invalid_descriptor", message } };
}

export function validateAtomDescriptor(value: unknown): AtomParseResult {
  if (!isRecord(value)) return invalid("Atom descriptor must be an object");
  if (value.format !== "plasmon.atom") return invalid("Atom descriptor format must be plasmon.atom");
  if (value.version !== 1) return invalid("Unsupported Atom descriptor version");
  if (typeof value.atomId !== "string" || !value.atomId.trim()) return invalid("Atom descriptor atomId is required");
  if (typeof value.handlerId !== "string" || !value.handlerId.trim()) return invalid("Atom descriptor handlerId is required");
  if (typeof value.atomType !== "string" || !value.atomType.trim()) return invalid("Atom descriptor atomType is required");
  if (!Number.isSafeInteger(value.schemaVersion) || (value.schemaVersion as number) < 1) return invalid("Atom schemaVersion must be a positive integer");
  if (value.title !== undefined && typeof value.title !== "string") return invalid("Atom title must be a string");
  if (value.sourceNodeId !== undefined && typeof value.sourceNodeId !== "string") return invalid("Atom sourceNodeId must be a string");
  if (value.metadata !== undefined && (!isRecord(value.metadata) || !isJsonValue(value.metadata))) return invalid("Atom metadata must contain JSON values");

  const descriptor: AtomDescriptor = {
    format: "plasmon.atom",
    version: 1,
    atomId: value.atomId,
    handlerId: value.handlerId,
    atomType: value.atomType,
    schemaVersion: value.schemaVersion as number,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.sourceNodeId === "string" ? { sourceNodeId: value.sourceNodeId } : {}),
    ...(isRecord(value.metadata) ? { metadata: value.metadata as Record<string, JsonValue> } : {}),
  };
  return { ok: true, descriptor };
}

export function tryParseAtomDescriptor(input: string | Uint8Array | unknown): AtomParseResult {
  let value = input;
  if (input instanceof Uint8Array) {
    try { value = new TextDecoder("utf-8", { fatal: true }).decode(input); }
    catch { return { ok: false, error: { code: "invalid_json", message: "Atom descriptor is not valid UTF-8" } }; }
  }
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; }
    catch { return { ok: false, error: { code: "invalid_json", message: "Atom descriptor is not valid JSON" } }; }
  }
  return validateAtomDescriptor(value);
}

export function parseAtomDescriptor(input: string | Uint8Array | unknown): AtomDescriptor {
  const result = tryParseAtomDescriptor(input);
  if (!result.ok) throw new Error(result.error.message);
  return result.descriptor;
}

function stableJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stableJson);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) result[key] = stableJson(value[key] as JsonValue);
    return result;
  }
  return value;
}

export function serializeAtomDescriptor(descriptor: AtomDescriptor): string {
  const checked = validateAtomDescriptor(descriptor);
  if (!checked.ok) throw new Error(checked.error.message);
  const value: Record<string, JsonValue> = {
    format: "plasmon.atom",
    version: 1,
    atomId: descriptor.atomId,
    handlerId: descriptor.handlerId,
    atomType: descriptor.atomType,
    schemaVersion: descriptor.schemaVersion,
  };
  if (descriptor.title !== undefined) value.title = descriptor.title;
  if (descriptor.sourceNodeId !== undefined) value.sourceNodeId = descriptor.sourceNodeId;
  if (descriptor.metadata !== undefined) value.metadata = stableJson(descriptor.metadata);
  return JSON.stringify(value);
}

export type AtomDescriptorUpdate = Partial<Pick<AtomDescriptor, "handlerId" | "atomType" | "schemaVersion" | "title" | "sourceNodeId" | "metadata">>;

export function updateAtomDescriptor(descriptor: AtomDescriptor, update: AtomDescriptorUpdate): AtomDescriptor {
  const next: AtomDescriptor = {
    ...descriptor,
    ...update,
    format: "plasmon.atom",
    version: 1,
    atomId: descriptor.atomId,
  };
  const checked = validateAtomDescriptor(next);
  if (!checked.ok) throw new Error(checked.error.message);
  return checked.descriptor;
}

export function tryGetAtomDescriptorFromNode(node: FsNode): AtomParseResult | null {
  const atom = node.metadata.atom;
  return atom === undefined ? null : validateAtomDescriptor(atom);
}

export function atomMetadata(descriptor: AtomDescriptor): JsonValue {
  return JSON.parse(serializeAtomDescriptor(descriptor)) as JsonValue;
}
