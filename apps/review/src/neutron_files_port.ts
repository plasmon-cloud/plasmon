import type { JsonObject, JsonValue, MsgBusEndpointId } from "neutron-tools/app";
import { callToolWithAttachments } from "./attachment_transport.ts";
import { FilePortError, type BinaryFileMetadata, type BinaryFileRead, type ReviewFilesPort } from "./file_ports.ts";

const FILES_TARGET = "app:files:background" as MsgBusEndpointId;
const SHA_256_ETAG = /^[a-f0-9]{64}$/u;
const ALLOWED_MEDIA_TYPES = new Set(["text/plain", "text/markdown", "application/octet-stream"]);

export class NeutronFilesPort implements ReviewFilesPort {
  constructor(private readonly callAttachments: typeof callToolWithAttachments = callToolWithAttachments) {}

  async readBinary(path: string, options: { ifMatch?: string; delegationToken?: string } = {}): Promise<BinaryFileRead> {
    const result = await this.callAttachments({
      target: FILES_TARGET,
      name: "readBinary",
      arguments: { path, ...(options.ifMatch ? { ifMatch: options.ifMatch } : {}) },
    }, [], { ...(options.delegationToken ? { delegationToken: options.delegationToken } : {}) });
    const metadata = parseMetadata(result.value);
    if (metadata.path !== path) throw invalidResponse("path does not match the requested file");
    if (options.ifMatch !== undefined && metadata.etag !== options.ifMatch) throw invalidResponse("etag does not match requested version");
    const attachment = result.attachments[0];
    if (result.attachments.length !== 1 || !attachment || attachment.name !== "file" || !(attachment.data instanceof ArrayBuffer)) {
      throw invalidResponse("read did not return exactly one file attachment");
    }
    if (attachment.byteLength !== metadata.byteLength || attachment.data.byteLength !== metadata.byteLength) throw invalidResponse("attachment length does not match metadata");
    if (await sha256Hex(attachment.data) !== metadata.etag) throw invalidResponse("attachment bytes do not match SHA-256 etag");
    return { ...metadata, data: attachment.data.slice(0) };
  }

  async writeBinary(
    path: string,
    mediaType: string,
    data: ArrayBuffer,
    condition: { ifMatch: string } | { ifNoneMatch: "*" },
    options: { delegationToken?: string } = {},
  ): Promise<BinaryFileMetadata> {
    const normalized = normalizeMediaType(mediaType);
    const payload = data.slice(0);
    const expectedEtag = await sha256Hex(payload);
    const result = await this.callAttachments({
      target: FILES_TARGET,
      name: "writeBinary",
      arguments: { path, mediaType: normalized, createParents: true, ...condition } as JsonObject,
    }, [{ name: "file", mediaType: attachmentMediaType(normalized), byteLength: payload.byteLength, data: payload }], {
      ...(options.delegationToken ? { delegationToken: options.delegationToken } : {}),
    });
    const metadata = parseMetadata(result.value);
    if (metadata.path !== path || metadata.mediaType !== normalized || metadata.byteLength !== payload.byteLength || metadata.etag !== expectedEtag || result.attachments.length !== 0) {
      throw invalidResponse("write result does not match requested file");
    }
    return metadata;
  }
}

function parseMetadata(value: JsonValue): BinaryFileMetadata {
  if (!isObject(value)) throw invalidResponse("metadata is not an object");
  const path = stringField(value, "path");
  const mediaType = normalizeMediaType(stringField(value, "mediaType"));
  const etag = stringField(value, "etag");
  if (!SHA_256_ETAG.test(etag)) throw invalidResponse("etag is not a lowercase SHA-256 digest");
  const byteLength = value.byteLength;
  if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) throw invalidResponse("byteLength is invalid");
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : undefined;
  return { path, mediaType, etag, byteLength: byteLength as number, ...(updatedAt !== undefined ? { updatedAt } : {}) };
}

function normalizeMediaType(value: string): string {
  const normalized = value.trim().toLowerCase().split(";", 1)[0]!;
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(normalized)) throw invalidResponse("mediaType is invalid");
  return normalized;
}

function attachmentMediaType(value: string): string {
  return ALLOWED_MEDIA_TYPES.has(value) ? value : "application/octet-stream";
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stringField(value: JsonObject, key: string): string {
  const entry = value[key];
  if (typeof entry !== "string" || !entry) throw invalidResponse(`metadata is missing ${key}`);
  return entry;
}

function invalidResponse(reason: string): FilePortError {
  return new FilePortError("FILES_INVALID_RESPONSE", "Files returned data that failed Review integrity validation", { reason });
}

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
